/**
 * @fileoverview This script is the core engine for custom fluid dynamics in Minecraft Bedrock Edition.
 * It manages everything from how fluids flow and spread to how entities interact with them.
 * The system is designed to be highly configurable through the `FluidRegistry`.
 */

//================================================================//
//                          IMPORTS
//================================================================//

import { world, system, Player, BlockPermutation, ItemStack, Direction, Block } from "@minecraft/server";
import { BlockUpdate } from "./BlockUpdate.js";
import { FluidQueue } from "./queue.js";
import { FluidRegistry } from "./registry.js";
import { effectHandlers } from "./effects/index.js";

//================================================================//
//                        CONFIGURATION
//================================================================//

/**
 * The maximum horizontal distance a fluid can spread from a source block.
 * A value of 7 mirrors the behavior of vanilla water and lava (source is 7, spreads down to 1).
 * @type {number}
 */
const MAX_SPREAD_DISTANCE = 7;

/**
 * The number of fluid block updates to process per game tick.
 * This is a crucial performance setting to prevent server lag when large bodies of fluid are active.
 * @type {number}
 */
const UPDATES_PER_TICK = 20;

//================================================================//
//                      CORE IMPLEMENTATION
//================================================================//

// --- Constants for Directional Logic ---

/**
 * Defines the four cardinal directions for horizontal fluid flow.
 * @type {Array<{dx: number, dy: number, dz: number, facing: string}>}
 */
const HORIZONTAL_DIRECTIONS = [
  { dx: 0, dy: 0, dz: -1, facing: "n" }, // North
  { dx: 1, dy: 0, dz: 0, facing: "e" }, // East
  { dx: 0, dy: 0, dz: 1, facing: "s" }, // South
  { dx: -1, dy: 0, dz: 0, facing: "w" }, // West
];

/**
 * Maps the engine's `Direction` enum to a simple {x, y, z} offset object.
 * Used for placing fluids from buckets based on the block face the player clicks.
 */
const directionToOffset = {
    [Direction.Up]: { x: 0, y: 1, z: 0 },
    [Direction.Down]: { x: 0, y: -1, z: 0 },
    [Direction.North]: { x: 0, y: 0, z: -1 },
    [Direction.South]: { x: 0, y: 0, z: 1 },
    [Direction.East]: { x: 1, y: 0, z: 0 },
    [Direction.West]: { x: -1, y: 0, z: 0 },
};

/**
 * An array of block state names used to control the visibility of each face of the fluid's model.
 * This is key to making fluids appear to connect seamlessly. The order is critical and must match the geometry file.
 * Order: North, East, South, West, Up, Down.
 */
const INVISIBLE_STATE_NAMES = [
  "lumstudio:invisible_north",
  "lumstudio:invisible_east",
  "lumstudio:invisible_south",
  "lumstudio:invisible_west",
  "lumstudio:invisible_up",
  "lumstudio:invisible_down"
];

/**
 * Maps a flow direction string to a numeric value used for rotating textures.
 * This allows the flowing fluid texture to align with the direction of flow.
 * Note: Diagonal directions were removed as they are not currently used by the flow logic.
 */
const flowDirectionToNumber = {
  "n": 0,
  "none": 0, // 'none' is the default when not flowing horizontally
  "e": 1,
  "s": 2,
  "w": 3,
};

// --- Global State ---

/**
 * A map storing a dedicated `FluidQueue` for each type of fluid.
 * This allows different fluids (e.g., water, lava) to be processed independently.
 * @type {Object.<string, FluidQueue>}
 */
const Queues = {};

// --- Utility Functions ---

/**
 * Compares two BlockPermutation objects to check if they are functionally identical.
 * This is more reliable than direct object comparison and avoids unnecessary block updates
 * if the state hasn't actually changed.
 * @param {BlockPermutation} perm1 The first permutation.
 * @param {BlockPermutation} perm2 The second permutation.
 * @returns {boolean} True if the permutations have the same states and values.
 */
function arePermutationsEqual(perm1, perm2) {
  // If either permutation is invalid, they can't be equal.
  if (!perm1 || !perm2) return false;
  
  // Get all block states from both permutations.
  const states1 = perm1.getAllStates();
  const states2 = perm2.getAllStates();

  // Check if they have the same number of states.
  if (Object.keys(states1).length !== Object.keys(states2).length) return false;

  // Check if every state in the first permutation has the same value in the second.
  return Object.keys(states1).every((stateKey) => states1[stateKey] === states2[stateKey]);
}

/**
 * Calculates the correct block states for a horizontally flowing fluid block.
 * This function determines which faces of the block model should be hidden to connect to neighbors
 * and sets the texture's rotation based on flow direction.
 * @param {BlockPermutation} permutation The block's current permutation.
 * @param {Array<object|undefined>} neighborStates An array of block states for the 4 horizontal neighbors.
 * @param {boolean} hasFluidBelow Whether there is a fluid block directly below this one.
 * @param {boolean} isSource Whether this block is a source block.
 * @param {string} flowDirection The direction the fluid is flowing ('n', 'e', 's', 'w', 'none').
 * @returns {BlockPermutation} The new, updated block permutation.
 */
function getHorizontalFlowPermutation(permutation, neighborStates, hasFluidBelow, isSource, flowDirection) {
  // Start with the current permutation and update its core states.
  let newPerm = permutation
    // Set the down-face visibility based on whether there's fluid below.
    .withState(INVISIBLE_STATE_NAMES[5], +hasFluidBelow) 
    // Set the flow direction, which controls texture rotation.
    .withState("lumstudio:direction", flowDirection);

  // Get the rotation number for the current flow direction.
  const rotation = flowDirectionToNumber[flowDirection];
  const currentDepth = permutation.getState("lumstudio:depth");

  // Iterate through the 4 horizontal neighbors (N, E, S, W).
  for (let i = 0; i < 4; i++) {
    const neighbor = neighborStates[i];
    // The index for the state name is rotated based on the flow direction.
    // This ensures the correct face (e.g., the "front" face) is checked against the correct neighbor.
    const stateIndex = (i + rotation) % 4; 

    if (neighbor) {
      // If a neighbor exists, check its depth.
      const neighborDepth = neighbor["lumstudio:depth"];
      // If the current block's depth is less than the neighbor's, it means we are flowing "into" it.
      // A value of '2' in the state likely corresponds to a full-face connection in the block model.
      // A value of '0' means the face is visible (no connection).
      newPerm = newPerm.withState(INVISIBLE_STATE_NAMES[stateIndex], currentDepth < neighborDepth ? 2 : 0);
    } else {
      // If there's no fluid neighbor in this direction, the face should be visible.
      newPerm = newPerm.withState(INVISIBLE_STATE_NAMES[stateIndex], 0);
    }
  }
  return newPerm;
}

/**
 * Calculates the correct block states for a vertically falling fluid block (a "waterfall").
 * @param {BlockPermutation} permutation The block's current permutation.
 * @param {Array<object|undefined>} neighborStates An array of block states for the 4 horizontal neighbors.
 * @param {boolean} hasFluidBelow Whether there is a fluid block directly below this one.
 * @param {boolean} hasFluidAbove Whether there is a fluid block directly above this one.
 * @param {boolean} isSource Whether this block is a source block.
 * @returns {BlockPermutation} The new, updated block permutation.
 */
function getFallingFlowPermutation(permutation, neighborStates, hasFluidBelow, hasFluidAbove, isSource) {
  // Start by setting the vertical visibility.
  let newPerm = permutation
    .withState(INVISIBLE_STATE_NAMES[4], +hasFluidAbove) // Set up-face visibility
    .withState(INVISIBLE_STATE_NAMES[5], +hasFluidBelow); // Set down-face visibility

  const currentDepth = permutation.getState("lumstudio:depth");

  // Iterate through horizontal neighbors to create "micro" connections for falling streams.
  for (let i = 0; i < 4; i++) {
    const neighbor = neighborStates[i];
    if (neighbor) {
      const neighborDepth = neighbor["lumstudio:depth"];
      // Check if the neighbor is a "micro-flow" (a thin stream connecting).
      // This specific condition creates a small connection if the neighbor's depth is exactly one less than expected.
      const isMicroConnection = neighborDepth === currentDepth - 1 - isSource;
      // If flowing into a deeper block, make a full connection (2).
      // If it's a micro-connection, make a partial connection (1).
      // Otherwise, no connection (0).
      newPerm = newPerm.withState(INVISIBLE_STATE_NAMES[i], currentDepth < neighborDepth ? 2 : +isMicroConnection);
    } else {
      // No neighbor, so the face is visible.
      newPerm = newPerm.withState(INVISIBLE_STATE_NAMES[i], 0);
    }
  }
  return newPerm;
}


/**
 * The main fluid simulation logic for a single block.
 * This function is called for each block in the FluidQueue.
 * @param {Block} block The fluid block to update.
 */
function fluidUpdate(block) {
    // --- 1. Initial Validation ---
    // Ensure the block is valid and is a custom fluid we can process.
    if (!block || !block.isValid() || !block.permutation) return;

    const typeId = block.typeId;
    const queue = Queues[typeId];
    if (!queue) return; // Not a fluid with a registered queue.

    // --- 2. State Initialization ---
    const currentPermutation = block.permutation;
    const blockStates = currentPermutation.getAllStates();
    const depth = blockStates["lumstudio:depth"];
    const isSourceBlock = depth === MAX_SPREAD_DISTANCE;

    // --- 3. Downward Flow (Falling) Logic ---
    // This is the highest priority. Fluids always try to flow down first.
    const blockBelow = block.below();
    if (blockBelow?.isAir) {
        // The block below is empty, so the fluid should fall into it.
        // A depth of '8' is a special state used for the falling part of a fluid stream.
        const fallingFluidPermutation = currentPermutation.withState("lumstudio:depth", isSourceBlock ? MAX_SPREAD_DISTANCE : 8);
        blockBelow.setPermutation(fallingFluidPermutation);
        queue.add(blockBelow); // Add the new falling block to the queue to be updated next tick.

        // If the current block is not a source, remove it, making it "move" down.
        if (!isSourceBlock) {
            block.setType('air');
        }
        return; // Stop further processing for this block this tick.
    }

    // --- 4. Sustainability & Neighbor Analysis ---
    // Determine if this fluid block should exist or decay.
    let canBeSustained = isSourceBlock; // Source blocks can always sustain themselves.
    let hasNeighborWithGreaterDepth = false;
    let maxNeighborDepth = -1;
    let flowDirection = "none";
    const neighborStates = [];

    // Check the four horizontal neighbors.
    for (let i = 0; i < HORIZONTAL_DIRECTIONS.length; i++) {
        const dir = HORIZONTAL_DIRECTIONS[i];
        const neighbor = block.offset(dir);

        if (neighbor?.typeId === typeId) {
            // This neighbor is the same type of fluid.
            const states = neighbor.permutation.getAllStates();
            neighborStates.push(states);
            if (states["lumstudio:depth"] > depth) {
                // This neighbor has a greater depth, so it can sustain the current block.
                hasNeighborWithGreaterDepth = true;
            }
            // Track the neighbor with the highest depth to determine flow direction.
            if (states["lumstudio:depth"] > maxNeighborDepth) {
                maxNeighborDepth = states["lumstudio:depth"];
                flowDirection = dir.facing;
            }
        } else {
            // This neighbor is not a fluid of the same type.
            neighborStates.push(undefined);
        }
    }

    // A block can also be sustained if it's part of a waterfall.
    const blockAbove = block.above();
    const isFlowingDownward = (blockAbove?.typeId === typeId);

    // Final check for sustainability.
    if (!canBeSustained) {
        canBeSustained = isFlowingDownward || hasNeighborWithGreaterDepth;
    }

    // --- 5. Decay Logic ---
    // If the block cannot be sustained, it should be removed.
    if (!canBeSustained) {
        block.setType('air');
        return; // Stop processing.
    }
    
    // --- 6. Horizontal Spreading Logic ---
    // If the fluid is not falling and has depth to spare, it should spread outwards.
    if (depth > 1 && !isFlowingDownward) {
        const newDepth = depth - 1; // The new fluid block will have one less depth.
        for (const dir of HORIZONTAL_DIRECTIONS) {
            const neighbor = block.offset(dir);
            if (neighbor?.isAir) {
                // Spread into adjacent air blocks.
                const spreadingPermutation = currentPermutation.withState("lumstudio:depth", newDepth);
                neighbor.setPermutation(spreadingPermutation);
                queue.add(neighbor); // Add the new block to the queue.
            }
        }
    }

    // --- 7. Final State Refresh ---
    // Calculate the final, correct visual permutation for the block based on its surroundings.
    const hasFluidBelow = block.below().typeId === typeId;
    let newPermutation;
    if (isFlowingDownward) {
        // Use the logic for falling fluids.
        newPermutation = getFallingFlowPermutation(currentPermutation, neighborStates, hasFluidBelow, isFlowingDownward, isSourceBlock);
    } else {
        // Use the logic for horizontal fluids.
        newPermutation = getHorizontalFlowPermutation(currentPermutation, neighborStates, hasFluidBelow, isSourceBlock, flowDirection);
    }

    // Only apply the new permutation if it's actually different from the old one.
    // This is an important optimization to prevent redundant block updates.
    if (!arePermutationsEqual(block.permutation, newPermutation)) {
        block.setPermutation(newPermutation);
    }
}

/**
 * Handles the logic for a player using a custom fluid bucket.
 * @param {ItemStack} itemStack The item being used.
 * @param {Player} player The player using the item.
 * @param {BlockHitInformation} hit The block hit information from the player's view.
 */
function placeFluidWithBucket(itemStack, player, hit) {
  // Check if the item is a custom fluid bucket.
  const isFluidBucket = itemStack.typeId.endsWith('_bucket');
  if (!hit || !isFluidBucket) return;

  // Determine the target block where the fluid should be placed.
  const { face, block } = hit;
  const targetBlock = block.offset(directionToOffset[face]);

  // Only place the fluid if the target block is air.
  if (targetBlock.isAir) {
    // Derive the fluid's typeId from the bucket's typeId.
    const fluidTypeId = itemStack.typeId.replace('_bucket', '');
    if (!FluidRegistry[fluidTypeId]) return; // Ensure it's a registered fluid.

    // Place the fluid block.
    targetBlock.setType(fluidTypeId);
    
    // Set the initial state to be a source block.
    const sourcePermutation = targetBlock.permutation
        .withState("lumstudio:depth", MAX_SPREAD_DISTANCE)
        .withState("lumstudio:direction", "none");
    targetBlock.setPermutation(sourcePermutation);
    
    // Add the new source block to the queue to begin flowing.
    const queue = Queues[fluidTypeId];
    if (queue) {
        queue.add(targetBlock);
    }

    // Replace the fluid bucket in the player's hand with an empty one.
    player.getComponent("equippable").setEquipment("Mainhand", new ItemStack("bucket"));
  }
}

/**
 * Initializes the entire fluid system, setting up queues and event listeners.
 */
function initialize() {
    // --- 1. Setup Fluid Queues ---
    // Create a new FluidQueue for each fluid defined in the registry.
    for (const fluidId in FluidRegistry) {
        Queues[fluidId] = new FluidQueue(fluidUpdate, fluidId);
        // Start the queue, processing a set number of updates per tick.
        Queues[fluidId].run(UPDATES_PER_TICK);
    }

    // --- 2. Setup Block Update Listener ---
    // Listen for any block changes in the world.
    BlockUpdate.on((update) => {
        if (!update) return;
        const { block } = update;
        // If the changed block is a custom fluid, add it to its queue to be re-evaluated.
        if (block && block.isValid() && Queues[block.typeId]) {
            Queues[block.typeId].add(block);
        }
    });

    // --- 3. Setup Player Interaction Listeners ---

    // Listen for a player using an item (e.g., a bucket).
    world.afterEvents.itemUse.subscribe(({ itemStack, source: player }) => {
        // Defer the logic by one tick to ensure world state is stable.
        system.run(() => {
            const hit = player.getBlockFromViewDirection({
                includePassableBlocks: true, // Allows targeting blocks like grass
                maxDistance: 6,
            });
            if (hit) {
                placeFluidWithBucket(itemStack, player, hit);
            }
        });
    });

    // Listen for interaction with our special pickup entity.
    // This is a workaround for detecting a right-click with an empty bucket on a fluid source.
    world.beforeEvents.playerInteractWithEntity.subscribe(event => {
        const { player, target } = event;
        if (target.typeId === 'lumstudio:fluid_pickup_entity') {
            event.cancel = true; // Prevent the default interaction.
            system.run(() => {
                const block = target.dimension.getBlock(target.location);
                // Check if the block is still a fluid.
                if (block && block.hasTag("fluid")) {
                    // Give the player a full bucket of that fluid.
                    const bucketItem = new ItemStack(`${block.typeId}_bucket`);
                    player.getComponent("equippable").setEquipment("Mainhand", bucketItem);
                    // Remove the fluid source block.
                    const oldBlockLocation = block.location; // Store location before setting to air.
                    block.setType('air');
                    // Manually trigger an update at the location where the fluid was removed.
                    BlockUpdate.trigger(player.dimension.getBlock(oldBlockLocation));
                }
                // Kill the temporary entity.
                target.kill();
            });
        }
    });

    // --- 4. Main Entity & Fluid Interaction Loop ---
    
    // These maps track entity states to optimize the loop.
    const entityLocations = new Map(); // Tracks the last known block location of an entity.
    const entitiesInFluid = new Set();   // Tracks entities currently inside a fluid.
    const pickupEntities = new Map();  // Tracks the temporary pickup entity for each player.

    // This loop runs 5 times per second (every 4 ticks).
    system.runInterval(() => {
        // --- A. Cleanup Stale Data ---
        // Remove entities that no longer exist from our trackers to prevent memory leaks.
        for (const entityId of entitiesInFluid) {
            if (!world.getEntity(entityId)) {
                entitiesInFluid.delete(entityId);
                entityLocations.delete(entityId);
            }
        }
        for (const [playerId, entityData] of pickupEntities.entries()) {
            if (!world.getEntity(entityData.id)) {
                pickupEntities.delete(playerId);
            }
        }

        // --- B. Handle Fluid Pickup Logic for Players ---
        for (const player of world.getAllPlayers()) {
            const mainhandItem = player.getComponent("equippable").getEquipment("Mainhand");
            const hit = player.getBlockFromViewDirection({
                includePassableBlocks: false, // Don't target non-solid blocks
                maxDistance: 6,
            });

            const hitLocationStr = hit?.block ? `${hit.block.location.x},${hit.block.location.y},${hit.block.location.z}` : null;
            const existingPickup = pickupEntities.get(player.id);

            // If the player was looking at a pickup entity but looked away, despawn it.
            if (existingPickup && existingPickup.location !== hitLocationStr) {
                const oldEntity = world.getEntity(existingPickup.id);
                if (oldEntity) oldEntity.kill();
                pickupEntities.delete(player.id);
            }

            // If the player is holding a bucket and looking at a fluid source, spawn a pickup entity.
            if (hit && mainhandItem?.typeId === 'minecraft:bucket') {
                const { block } = hit;
                const depth = block.permutation?.getState("lumstudio:depth");

                // Only allow pickup from source blocks.
                if (block.hasTag("fluid") && depth === MAX_SPREAD_DISTANCE && !pickupEntities.has(player.id)) {
                    const entity = player.dimension.spawnEntity('lumstudio:fluid_pickup_entity', block.center());
                    pickupEntities.set(player.id, { id: entity.id, location: hitLocationStr });
                }
            }
        }

        // --- C. Detect Entities in Fluids ---
        // NOTE: This is a potentially performance-intensive operation on servers with many entities.
        // The `getEntities` call iterates over ALL loaded entities in a dimension.
        // The logic is optimized by only checking entities that have moved to a new block.
        const dimensions = [
            world.getDimension("overworld"),
            world.getDimension("nether"),
            world.getDimension("the_end")
        ];

        for (const dimension of dimensions) {
            if (!dimension) continue;
            for (const entity of dimension.getEntities({})) {
                const lastLocation = entityLocations.get(entity.id);
                const currentLocation = entity.location;

                // Optimization: Only process if the entity has moved to a different block.
                if (!lastLocation || Math.floor(currentLocation.x) !== Math.floor(lastLocation.x) || Math.floor(currentLocation.y) !== Math.floor(lastLocation.y) || Math.floor(currentLocation.z) !== Math.floor(lastLocation.z)) {
                    entityLocations.set(entity.id, currentLocation); // Update last known location.

                    const blockAtEntity = entity.dimension.getBlock(currentLocation);
                    const isInFluid = FluidRegistry[blockAtEntity?.typeId];

                    if (isInFluid) {
                        entitiesInFluid.add(entity.id); // Mark entity as being in a fluid.
                    } else if (entitiesInFluid.has(entity.id)) {
                        // Entity was in a fluid but is no longer.
                        entitiesInFluid.delete(entity.id);
                        // If it's a player, remove any active fog effect.
                        if (entity.typeId === "minecraft:player") {
                            entity.runCommand("fog @s remove fluid_fog");
                        }
                    }
                }
            }
        }

        // --- D. Apply Fluid Effects to Entities ---
        for (const entityId of entitiesInFluid) {
            const entity = world.getEntity(entityId);
            if (!entity) continue; // Skip if entity became invalid.

            const bodyBlock = entity.dimension.getBlock(entity.location);
            const fluidData = FluidRegistry[bodyBlock?.typeId];

            // If the entity is somehow no longer in a valid fluid, remove it from the set.
            if (!fluidData) {
                entitiesInFluid.delete(entityId);
                if (entity.typeId === "minecraft:player") {
                    entity.runCommand("fog @s remove fluid_fog");
                }
                continue;
            }

            // Apply fog effect if the player's head is in the fluid.
            if (entity.typeId === "minecraft:player") {
                const headBlock = entity.getHeadLocation();
                const fluidInHead = entity.dimension.getBlock(headBlock)?.typeId;
                const fluidDataInHead = FluidRegistry[fluidInHead];
                if (fluidDataInHead && fluidDataInHead.fog) {
                    const fogId = `lumstudio:${fluidDataInHead.fog}_fog`;
                    entity.runCommand(`fog @s push ${fogId} fluid_fog`);
                } else {
                    entity.runCommand("fog @s remove fluid_fog");
                }
            }

            // Simulate viscosity/drag when jumping.
            if (entity.isJumping) {
                entity.addEffect("slow_falling", 5, { showParticles: false, amplifier: 1 });
            }
            
            // Simulate buoyancy by applying a gentle upward force.
            const velocity = entity.getVelocity();
            if (velocity.y < 0.05) { // Only apply when sinking or moving slowly.
                const buoyancyForce = Math.abs(velocity.y) * 0.3 + (fluidData.buoyancy || 0);
                entity.applyKnockback(0, 0, 0, buoyancyForce);
            }

            // Apply any other custom effects defined in the registry (damage, burn, etc.).
            for (const effectKey in fluidData) {
                if (effectHandlers[effectKey]) {
                    try {
                        effectHandlers[effectKey](entity, fluidData);
                    } catch (e) {
                        console.error(`Error applying effect '${effectKey}' on entity ${entity.id}: ${e}`);
                    }
                }
            }
        }
    }, 4); // Run this entire loop every 4 ticks.
}

// --- Start the System ---
initialize();
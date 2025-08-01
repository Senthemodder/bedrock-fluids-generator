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
 * @type {Object.<string, FluidQueue>}
 */
const Queues = {};

/**
 * @type {Set<string>}
 * @description A set that tracks the location string of every active fluid block in the world.
 * This is the core of the entity detection optimization. Instead of checking every entity
 * in the world, we only check for entities inside these specific blocks.
 * The location string is formatted as "x,y,z,dimensionId".
 */
const activeFluidBlocks = new Set();

// --- Utility Functions ---

/**
 * Creates a standardized location string for use in the `activeFluidBlocks` set.
 * @param {Block} block The block to get a location string for.
 * @returns {string} A string formatted as "x,y,z,dimensionId".
 */
function getBlockLocationString(block) {
    return `${block.location.x},${block.location.y},${block.location.z},${block.dimension.id}`;
}

/**
 * Compares two BlockPermutation objects to check if they are functionally identical.
 * @param {BlockPermutation} perm1 The first permutation.
 * @param {BlockPermutation} perm2 The second permutation.
 * @returns {boolean} True if the permutations have the same states and values.
 */
function arePermutationsEqual(perm1, perm2) {
  if (!perm1 || !perm2) return false;
  const states1 = perm1.getAllStates();
  const states2 = perm2.getAllStates();
  if (Object.keys(states1).length !== Object.keys(states2).length) return false;
  return Object.keys(states1).every((stateKey) => states1[stateKey] === states2[stateKey]);
}

/**
 * Calculates the correct block states for a horizontally flowing fluid block.
 * @param {BlockPermutation} permutation The block's current permutation.
 * @param {Array<object|undefined>} neighborStates An array of block states for the 4 horizontal neighbors.
 * @param {boolean} hasFluidBelow Whether there is a fluid block directly below this one.
 * @param {boolean} isSource Whether this block is a source block.
 * @param {string} flowDirection The direction the fluid is flowing ('n', 'e', 's', 'w', 'none').
 * @returns {BlockPermutation} The new, updated block permutation.
 */
function getHorizontalFlowPermutation(permutation, neighborStates, hasFluidBelow, isSource, flowDirection) {
  let newPerm = permutation
    .withState(INVISIBLE_STATE_NAMES[5], +hasFluidBelow) 
    .withState("lumstudio:direction", flowDirection);

  const rotation = flowDirectionToNumber[flowDirection];
  const currentDepth = permutation.getState("lumstudio:depth");

  for (let i = 0; i < 4; i++) {
    const neighbor = neighborStates[i];
    const stateIndex = (i + rotation) % 4; 

    if (neighbor) {
      const neighborDepth = neighbor["lumstudio:depth"];
      newPerm = newPerm.withState(INVISIBLE_STATE_NAMES[stateIndex], currentDepth < neighborDepth ? 2 : 0);
    } else {
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
  let newPerm = permutation
    .withState(INVISIBLE_STATE_NAMES[4], +hasFluidAbove)
    .withState(INVISIBLE_STATE_NAMES[5], +hasFluidBelow);

  const currentDepth = permutation.getState("lumstudio:depth");

  for (let i = 0; i < 4; i++) {
    const neighbor = neighborStates[i];
    if (neighbor) {
      const neighborDepth = neighbor["lumstudio:depth"];
      const isMicroConnection = neighborDepth === currentDepth - 1 - isSource;
      newPerm = newPerm.withState(INVISIBLE_STATE_NAMES[i], currentDepth < neighborDepth ? 2 : +isMicroConnection);
    } else {
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
    if (!block || !block.isValid() || !block.permutation) return;

    const typeId = block.typeId;
    const queue = Queues[typeId];
    if (!queue) return;

    const currentPermutation = block.permutation;
    const blockStates = currentPermutation.getAllStates();
    const depth = blockStates["lumstudio:depth"];
    const isSourceBlock = depth === MAX_SPREAD_DISTANCE;

    const blockBelow = block.below();
    if (blockBelow?.isAir) {
        const fallingFluidPermutation = currentPermutation.withState("lumstudio:depth", isSourceBlock ? MAX_SPREAD_DISTANCE : 8);
        blockBelow.setPermutation(fallingFluidPermutation);
        activeFluidBlocks.add(getBlockLocationString(blockBelow)); // OPTIMIZATION: Track new fluid block
        queue.add(blockBelow);

        if (!isSourceBlock) {
            activeFluidBlocks.delete(getBlockLocationString(block)); // OPTIMIZATION: Untrack old fluid block
            block.setType('air');
        }
        return;
    }

    let canBeSustained = isSourceBlock;
    let hasNeighborWithGreaterDepth = false;
    let maxNeighborDepth = -1;
    let flowDirection = "none";
    const neighborStates = [];

    for (let i = 0; i < HORIZONTAL_DIRECTIONS.length; i++) {
        const dir = HORIZONTAL_DIRECTIONS[i];
        const neighbor = block.offset(dir);

        if (neighbor?.typeId === typeId) {
            const states = neighbor.permutation.getAllStates();
            neighborStates.push(states);
            if (states["lumstudio:depth"] > depth) {
                hasNeighborWithGreaterDepth = true;
            }
            if (states["lumstudio:depth"] > maxNeighborDepth) {
                maxNeighborDepth = states["lumstudio:depth"];
                flowDirection = dir.facing;
            }
        } else {
            neighborStates.push(undefined);
        }
    }

    const blockAbove = block.above();
    const isFlowingDownward = (blockAbove?.typeId === typeId);

    if (!canBeSustained) {
        canBeSustained = isFlowingDownward || hasNeighborWithGreaterDepth;
    }

    if (!canBeSustained) {
        activeFluidBlocks.delete(getBlockLocationString(block)); // OPTIMIZATION: Untrack decayed fluid block
        block.setType('air');
        return;
    }
    
    if (depth > 1 && !isFlowingDownward) {
        const newDepth = depth - 1;
        for (const dir of HORIZONTAL_DIRECTIONS) {
            const neighbor = block.offset(dir);
            if (neighbor?.isAir) {
                const spreadingPermutation = currentPermutation.withState("lumstudio:depth", newDepth);
                neighbor.setPermutation(spreadingPermutation);
                activeFluidBlocks.add(getBlockLocationString(neighbor)); // OPTIMIZATION: Track new fluid block
                queue.add(neighbor);
            }
        }
    }

    const hasFluidBelow = block.below().typeId === typeId;
    let newPermutation;
    if (isFlowingDownward) {
        newPermutation = getFallingFlowPermutation(currentPermutation, neighborStates, hasFluidBelow, isFlowingDownward, isSourceBlock);
    } else {
        newPermutation = getHorizontalFlowPermutation(currentPermutation, neighborStates, hasFluidBelow, isSourceBlock, flowDirection);
    }

    if (!arePermutationsEqual(block.permutation, newPermutation)) {
        block.setPermutation(newPermutation);
    }
}

/**
 * Handles the logic for a player using a custom fluid bucket.
 * @param {ItemStack} itemStack The item being used.
 * @param {Player} player The player using the item.
 * @param {Block} block The block that was interacted with.
 * @param {Direction} face The face of the block that was interacted with.
 */
function placeFluidWithBucket(itemStack, player, block, face) {
  const isFluidBucket = itemStack.typeId.endsWith('_bucket');
  if (!isFluidBucket) return;

  let targetBlock;
  switch (face) {
    case Direction.Up: targetBlock = block.above(1); break;
    case Direction.Down: targetBlock = block.below(1); break;
    case Direction.North: targetBlock = block.north(1); break;
    case Direction.South: targetBlock = block.south(1); break;
    case Direction.East: targetBlock = block.east(1); break;
    case Direction.West: targetBlock = block.west(1); break;
    default: return;
  }

  if (targetBlock && targetBlock.isAir) {
    const fluidTypeId = itemStack.typeId.replace('_bucket', '');
    if (!FluidRegistry[fluidTypeId]) return;

    targetBlock.setType(fluidTypeId);
    
    const sourcePermutation = targetBlock.permutation
        .withState("lumstudio:depth", MAX_SPREAD_DISTANCE)
        .withState("lumstudio:direction", "none");
    targetBlock.setPermutation(sourcePermutation);
    
    activeFluidBlocks.add(getBlockLocationString(targetBlock)); // OPTIMIZATION: Track new fluid block
    
    const queue = Queues[fluidTypeId];
    if (queue) {
        queue.add(targetBlock);
    }

    player.getComponent("equippable").setEquipment("Mainhand", new ItemStack("bucket"));
  }
}

/**
 * Initializes the entire fluid system, setting up queues and event listeners.
 */
function initialize() {
    // --- 1. Setup Fluid Queues ---
    for (const fluidId in FluidRegistry) {
        Queues[fluidId] = new FluidQueue(fluidUpdate, fluidId);
        Queues[fluidId].run(UPDATES_PER_TICK);
    }

    // --- 2. Setup Block Update Listener ---
    BlockUpdate.on((update) => {
        if (!update) return;
        const { block } = update;
        if (block && block.isValid() && Queues[block.typeId]) {
            Queues[block.typeId].add(block);
        }
    });

    // --- 3. Setup Player Interaction Listeners ---

    // Event for PLACING fluid - using a more specific event
    world.beforeEvents.playerInteractWithBlock.subscribe(event => {
        const { player, block, itemStack } = event;
        if (!itemStack) return;

        // Check if the player is trying to place a fluid from a bucket
        if (itemStack.typeId.endsWith('_bucket')) {
            // We are placing a fluid, so we cancel the default block interaction.
            event.cancel = true;
            
            // Run the placement logic in the next tick.
            system.run(() => {
                placeFluidWithBucket(itemStack, player, block, event.face);
            });
        }
    });

    // Event for TAKING fluid (by interacting with the dummy entity)
    world.beforeEvents.playerInteractWithEntity.subscribe(event => {
        const { player, target } = event;
        if (target.typeId === 'lumstudio:fluid_pickup_entity') {
            event.cancel = true; // Prevent default interaction
            system.run(() => {
                // The block is at the same location as the entity
                const block = target.dimension.getBlock(target.location);
                if (block && block.hasTag("fluid")) {
                    // Give player a full bucket
                    const bucketItem = new ItemStack(`${block.typeId}_bucket`);
                    player.getComponent("equippable").setEquipment("Mainhand", bucketItem);
                    
                    const oldBlockLocation = block.location;
                    activeFluidBlocks.delete(getBlockLocationString(block));
                    block.setType('air');
                    BlockUpdate.trigger(player.dimension.getBlock(oldBlockLocation));
                }
                // The entity has served its purpose, kill it.
                target.kill();
            });
        }
    });
    
    // --- 4. Main Tick Loop ---
    const entitiesInFluid = new Set();
    /** 
     * @type {Map<string, {id: string, block: Block}>} 
     * @description Tracks the pickup entity for each player.
     * The key is the player's ID.
     * The value is an object containing the entity's ID and the Block it's associated with.
     */
    const pickupEntities = new Map();

    // This loop runs every single tick to ensure the pickup logic is highly responsive.
    system.runInterval(() => {
        // --- A. Cleanup Stale Data ---
        // This is a quick check to remove any entities that might have despawned unexpectedly.
        for (const entityId of entitiesInFluid) {
            if (!world.getEntity(entityId)) entitiesInFluid.delete(entityId);
        }
        for (const [playerId, entityData] of pickupEntities.entries()) {
            if (!world.getEntity(entityData.id)) pickupEntities.delete(playerId);
        }

        // --- B. Raycast-based Pickup Entity Management ---
        // This loop handles the core logic for showing and hiding the interactable entity for picking up fluids.
        for (const player of world.getAllPlayers()) {
            /** @type {ItemStack | undefined} The item the player is currently holding. */
            const mainhandItem = player.getComponent("equippable").getEquipment("Mainhand");
            
            /** @type {BlockRaycastHit | undefined} The result of a raycast from the player's view. */
            const hit = player.getBlockFromViewDirection({
                includePassableBlocks: false, // We only care about solid blocks for this.
                maxDistance: 6,
            });
            /** @type {Block | undefined} The block the player is currently looking at. */
            const targetedBlock = hit?.block;
            /** @type {{id: string, block: Block} | undefined} The existing pickup entity data for this player, if any. */
            const existingPickup = pickupEntities.get(player.id);

            // Despawn Logic: If an entity exists, but the player is no longer looking at its block, kill it.
            // This ensures the pickup entity only exists while the player is aiming at the correct block.
            if (existingPickup && (!targetedBlock || !targetedBlock.equals(existingPickup.block))) {
                const oldEntity = world.getEntity(existingPickup.id);
                if (oldEntity) oldEntity.kill();
                pickupEntities.delete(player.id);
            }

            // Spawn Logic: If the player is looking at a valid fluid source with a bucket, spawn the entity.
            if (targetedBlock && mainhandItem?.typeId === 'minecraft:bucket') {
                /** @type {number | undefined} The depth state of the block being looked at. */
                const depth = targetedBlock.permutation?.getState("lumstudio:depth");
                // Check if it's a source block and no entity exists for this player yet.
                if (targetedBlock.hasTag("fluid") && depth === MAX_SPREAD_DISTANCE && !existingPickup) {
                    /** @type {Entity} The newly spawned, invisible entity. */
                    const entity = player.dimension.spawnEntity('lumstudio:fluid_pickup_entity', targetedBlock.center());
                    // Store the new entity's ID and the block it's tied to.
                    pickupEntities.set(player.id, { id: entity.id, block: targetedBlock });
                }
            }
        }

        // --- C. Detect Entities in Fluids (OPTIMIZED) ---
        /** @type {Set<string>} A temporary set to track entities found in fluids during this specific tick. */
        const entitiesFoundThisTick = new Set();

        /** @type {string} A location string for a fluid block, e.g., "10,20,30,minecraft:overworld". */
        for (const locationStr of activeFluidBlocks) {
            /** @type {string[]} The location string split into its components. */
            const parts = locationStr.split(',');
            /** @type {Vector} The coordinate vector of the fluid block. */
            const location = { x: +parts[0], y: +parts[1], z: +parts[2] };
            /** @type {string} The dimension ID where the fluid block exists. */
            const dimensionId = parts[3];
            /** @type {Dimension} The dimension object itself. */
            const dimension = world.getDimension(dimensionId);

            /** @type {Entity[]} An array of entities found near the fluid block. */
            const entitiesAtLocation = dimension.getEntities({ location, maxDistance: 2 });

            for (const entity of entitiesAtLocation) {
                /** @type {Block | undefined} The block at the entity's exact location (feet). */
                const bodyBlock = entity.dimension.getBlock(entity.location);
                
                // Check if the entity's feet are inside a fluid block of a known type.
                if (bodyBlock && FluidRegistry[bodyBlock.typeId]) {
                    // Add the entity's ID to the set of entities currently in fluid.
                    entitiesInFluid.add(entity.id);
                    // Also add it to the set for this tick, to know it's still in a fluid.
                    entitiesFoundThisTick.add(entity.id);
                }
            }
        }

        // --- D. Cleanup Entities No Longer in Fluid ---
        /** @type {string} The unique ID of an entity. */
        for (const entityId of entitiesInFluid) {
            // If an entity was in a fluid last tick but wasn't found this tick, it has exited.
            if (!entitiesFoundThisTick.has(entityId)) {
                /** @type {Entity | undefined} The entity that has left the fluid. */
                const entity = world.getEntity(entityId);
                // If it's a player, remove the fog effect.
                if (entity && entity.typeId === "minecraft:player") {
                    entity.runCommand("fog @s remove fluid_fog");
                }
                // Remove the entity from the main tracking set.
                entitiesInFluid.delete(entityId);
            }
        }

        // --- E. Apply Fluid Effects to Entities ---
        for (const entityId of entitiesInFluid) {
            const entity = world.getEntity(entityId);
            if (!entity) continue;

            const bodyBlock = entity.dimension.getBlock(entity.location);
            const fluidData = FluidRegistry[bodyBlock?.typeId];

            if (!fluidData) {
                entitiesInFluid.delete(entityId);
                if (entity.typeId === "minecraft:player") {
                    entity.runCommand("fog @s remove fluid_fog");
                }
                continue;
            }

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

            if (entity.typeId === "minecraft:player" && entity.isJumping) {
                entity.addEffect("slow_falling", 5, { showParticles: false, amplifier: 1 });
            }
            
            const velocity = entity.getVelocity();
            if (velocity.y < 0.05) {
                const buoyancyForce = Math.abs(velocity.y) * 0.3 + (fluidData.buoyancy || 0);
                entity.applyKnockback(0, 0, 0, buoyancyForce);
            }

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
    }, 1); // Run every tick for responsive pickup entity
}

// --- Start the System ---
initialize();

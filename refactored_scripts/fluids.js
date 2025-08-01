import { world, system, Player, BlockPermutation, ItemStack, Direction, Block } from "@minecraft/server";
import { BlockUpdate } from "./BlockUpdate.js";
import { FluidQueue } from "./queue.js";

//================================================================//
//                        CONFIGURATION
//================================================================//

import { FluidRegistry } from "./registry.js";

const MAX_SPREAD_DISTANCE = 7;
const UPDATES_PER_TICK = 20;

//================================================================//
//                      CORE IMPLEMENTATION
//================================================================//

const DIRECTIONS = [
  { dx: 0, dy: 0, dz: -1, facing: "n" },
  { dx: 1, dy: 0, dz: 0, facing: "e" },
  { dx: 0, dy: 0, dz: 1, facing: "s" },
  { dx: -1, dy: 0, dz: 0, facing: "w" },
];

const directionToOffset = {
    [Direction.Up]: { x: 0, y: 1, z: 0 },
    [Direction.Down]: { x: 0, y: -1, z: 0 },
    [Direction.North]: { x: 0, y: 0, z: -1 },
    [Direction.South]: { x: 0, y: 0, z: 1 },
    [Direction.East]: { x: 1, y: 0, z: 0 },
    [Direction.West]: { x: -1, y: 0, z: 0 },
};
const Queues = {};

const invisibleStatesNames = [
  "lumstudio:invisible_north",
  "lumstudio:invisible_east",
  "lumstudio:invisible_south",
  "lumstudio:invisible_west",
  "lumstudio:invisible_up",
  "lumstudio:invisible_down"
];

const directionNums = {
  "n": 0,
  "none": 0,
  "e": 1,
  "s": 2,
  "w": 3,
  "ne": 0,
  "se": 1,
  "sw": 2,
  "nw": 3,
};

/**
 * 
 * @param {BlockPermutation} perm1 
 * @param {BlockPermutation} perm2 
 */
function areEqualPerms(perm1, perm2) {
  if (!perm1 || !perm2) return false;
  const states1 = perm1.getAllStates();
  const states2 = perm2.getAllStates();
  return Object.keys(states1).every((value) => states1[value] === states2[value])
}

/**
 * Schedules updates for a block's neighbors.
 * @param {Block} block The block whose neighbors need to be updated.
 */
function markNeighborsForUpdate(block) {
    const queue = Queues[block.typeId];
    if (!queue) return;

    for (const dir of DIRECTIONS) {
        const neighbor = block.offset(dir);
        if (neighbor?.typeId === block.typeId) {
            queue.add(neighbor);
        }
    }
    const blockAbove = block.above();
    if (blockAbove?.typeId === block.typeId) {
        queue.add(blockAbove);
    }
    const blockBelow = block.below();
    if (blockBelow?.typeId === block.typeId) {
        queue.add(blockBelow);
    }
}


/**
 * Refreshes the fluid states.
 * @param {BlockPermutation} permutation The fluid block permutation.
 * @param {Record<string, string | number | boolean>[]} neighborStates States of Neighbor fluids
 * @param {boolean} below 
 * @param {string} flowDirection The direction of the fluid flow.
 * @returns new permutation
 */
function refreshStates(permutation, neighborStates, below, isSource, flowDirection) {
  let newPerm = permutation.withState(invisibleStatesNames[5], +below)
                           .withState("lumstudio:direction", flowDirection);

  const num = directionNums[flowDirection];
  for (let i = 0; i < 4; i++) {
    if (neighborStates[i]) {
      const nDepth = neighborStates[i]["lumstudio:depth"];
      const depth = permutation.getState("lumstudio:depth");
      newPerm = newPerm.withState(invisibleStatesNames[(i + num) % 4], depth < nDepth ? 2 : 0)
    } else {
      newPerm = newPerm.withState(invisibleStatesNames[(i + num) % 4], 0);
    }
  }
  return newPerm;
}

/**
 * Refreshes the fluid states for a falling fluid.
 * @param {BlockPermutation} permutation The fluid block permutation.
 * @param {Record<string, string | number | boolean>[]} neighborStates States of Neighbor fluids
 * @param {boolean} above 
 * @param {boolean} below 
 * @param {boolean} isSource 
 * @returns new permutation
 */
function refreshStatesForFalling(permutation, neighborStates, below, above, isSource) {
  let newPerm = permutation
    .withState(invisibleStatesNames[4], +above)
    .withState(invisibleStatesNames[5], +below);
  for (let i = 0; i < 4; i++) {
    if (neighborStates[i]) {
      const nDepth = neighborStates[i]["lumstudio:depth"];
      const depth = permutation.getState("lumstudio:depth");
      const isMicro = nDepth === depth - 1 - isSource;
      newPerm = newPerm.withState(invisibleStatesNames[i], depth < nDepth ? 2 : +isMicro)
    } else {
      newPerm = newPerm.withState(invisibleStatesNames[i], 0);
    }
  }
  return newPerm;
}

/**
 * Processes a single fluid block update. This function is the core of the fluid simulation logic.
 * @param {import("@minecraft/server").Block} block The block to update.
 */
function fluidUpdate(block) {
    if (!block || !block.isValid() || !block.permutation) return;

    let currentPermutation = block.permutation;
    const blockStates = currentPermutation.getAllStates();
    const depth = blockStates["lumstudio:depth"];
    const isSourceBlock = depth === MAX_SPREAD_DISTANCE;

    const blockAbove = block.above();
    let isFlowingDownward = (blockAbove?.typeId === block.typeId);

    const blockBelow = block.below();
    if (blockBelow?.isAir) {
        const fallingFluidPermutation = currentPermutation.withState("lumstudio:depth", isSourceBlock ? MAX_SPREAD_DISTANCE : 8);
        blockBelow.setPermutation(fallingFluidPermutation);
        markNeighborsForUpdate(blockBelow);

        if (!isSourceBlock) {
            block.setType('air');
            markNeighborsForUpdate(block);
        }
        return;
    }

    let canBeSustained = isSourceBlock;
    let neighborWithGreaterDepth = false;
    let maxNeighborDepth = -1;
    let flowDirection = "none";
    const neighborStates = [];

    for (let i = 0; i < DIRECTIONS.length; i++) {
        const dir = DIRECTIONS[i];
        const neighbor = block.offset(dir);
        if (neighbor?.typeId === block.typeId) {
            const states = neighbor.permutation.getAllStates();
            neighborStates.push(states);
            if (states["lumstudio:depth"] > depth) {
                neighborWithGreaterDepth = true;
            }
            if (states["lumstudio:depth"] > maxNeighborDepth) {
                maxNeighborDepth = states["lumstudio:depth"];
                flowDirection = dir.facing;
            }
        } else {
            neighborStates.push(undefined);
        }
    }

    if (!canBeSustained) {
        if (blockAbove?.typeId === block.typeId) {
            canBeSustained = true;
        } else {
            canBeSustained = neighborWithGreaterDepth;
        }
    }

    if (!canBeSustained) {
        block.setType('air');
        markNeighborsForUpdate(block);
        return;
    }
    
    if (blockAbove?.typeId === block.typeId) {
        isFlowingDownward = true;
    }

    if (depth > 0 && !isFlowingDownward) {
        const newDepth = depth - 1;
        if (newDepth > 0) {
            for (const dir of DIRECTIONS) {
                const neighbor = block.offset(dir);
                if (neighbor?.isAir) {
                    const spreadingPermutation = currentPermutation.withState("lumstudio:depth", newDepth);
                    neighbor.setPermutation(spreadingPermutation);
                    markNeighborsForUpdate(neighbor);
                }
            }
        }
    }

    const hasFluidBelow = block.below().typeId === block.typeId;
    let newPermutation;
    if (isFlowingDownward) {
        newPermutation = refreshStatesForFalling(currentPermutation, neighborStates, hasFluidBelow, blockAbove?.typeId === block.typeId, isSourceBlock);
    } else {
        newPermutation = refreshStates(currentPermutation, neighborStates, hasFluidBelow, isSourceBlock, flowDirection);
    }

    if (!areEqualPerms(block.permutation, newPermutation)) {
        block.setPermutation(newPermutation);
        markNeighborsForUpdate(block);
    }
}

/**
 * Handles the logic for placing fluid from a bucket or picking it up into an empty bucket.
 * This function is called when a player uses an item.
 * @param {ItemStack} itemStack The item that was used.
 * @param {Player} player The player who used the item.
 * @param {import("@minecraft/server").BlockHitInformation} hit The block that was hit by the player's view, or null.
 */
function placeOrTakeFluid(itemStack, player, hit) {
  const isFluidBucket = itemStack.typeId.endsWith('_bucket');
  if (!hit) return;

  const { face, block } = hit;
  const targetBlock = block.offset(directionToOffset[face]);

  if (targetBlock.isAir && isFluidBucket) {
    const fluidTypeId = itemStack.typeId.replace('_bucket', '');
    if (!FluidRegistry[fluidTypeId]) return;

    targetBlock.setType(fluidTypeId);
    const fluidPermutation = targetBlock.permutation;
    
    const finalPermutation = fluidPermutation
        .withState("lumstudio:depth", 7)
        .withState("lumstudio:direction", "none");

    targetBlock.setPermutation(finalPermutation);
    
    player.getComponent("equippable").setEquipment("Mainhand", new ItemStack("bucket"));
    return;
  }

  const fluidDepth = targetBlock.permutation?.getState("lumstudio:depth");
  if (targetBlock.hasTag("fluid") && fluidDepth === MAX_SPREAD_DISTANCE && itemStack.typeId === "minecraft:bucket") {
    const bucketItem = new ItemStack(`${targetBlock.typeId}_bucket`); 
    
    targetBlock.setType('air');
    player.getComponent("equippable").setEquipment("Mainhand", bucketItem);
  }
}

import { effectHandlers } from "./effects/index.js";

function initialize() {
    for (const fluidId in FluidRegistry) {
        Queues[fluidId] = new FluidQueue(fluidUpdate, fluidId);
        Queues[fluidId].run(UPDATES_PER_TICK);
    }

    BlockUpdate.on((update) => {
        if (!update) {
            console.warn("BlockUpdate.on received a falsy update object.");
            return;
        }
        const { block } = update;
        if (!block) {
            console.warn("BlockUpdate.on: update object has no 'block' property.");
            return;
        }

        if (block.isValid()) {
            const queue = Queues[block.typeId];
            if (queue) {
                if (typeof queue.add === 'function') {
                    queue.add(block);
                } else {
                    console.error(`Error: queue.add is not a function for fluid ${block.typeId}.`);
                }
            }
        }
    });

    world.afterEvents.itemUse.subscribe(({ itemStack, source: player }) => {
        system.run(() => {
            const hit = player.getBlockFromViewDirection({
                includePassableBlocks: true,
                maxDistance: 6,
            });
            if (hit) {
                placeOrTakeFluid(itemStack, player, hit);
            }
        });
    });

    const entityLocations = new Map();
    const entitiesInFluid = new Set();

    system.runInterval(() => {
        const dimensions = [
            world.getDimension("overworld"),
            world.getDimension("nether"),
            world.getDimension("the_end")
        ];

        // Part 1: Update the set of entities that are currently in a fluid.
        for (const dimension of dimensions) {
            if (!dimension) continue; // Skip if a dimension doesn't exist
            for (const entity of dimension.getEntities({})) {
                const lastLocation = entityLocations.get(entity.id);
                const currentLocation = entity.location;

                // Check if the entity has moved to a new block, or if it's the first time we've seen it.
                if (!lastLocation || Math.floor(currentLocation.x) !== Math.floor(lastLocation.x) || Math.floor(currentLocation.y) !== Math.floor(lastLocation.y) || Math.floor(currentLocation.z) !== Math.floor(lastLocation.z)) {
                    entityLocations.set(entity.id, currentLocation); // Update the known location

                    const newBlock = entity.dimension.getBlock(currentLocation);
                    const isInFluid = FluidRegistry[newBlock?.typeId];

                    if (isInFluid) {
                        entitiesInFluid.add(entity.id);
                    } else if (entitiesInFluid.has(entity.id)) {
                        // Entity was in a fluid but is no longer.
                        entitiesInFluid.delete(entity.id);
                        if (entity.typeId === "minecraft:player") {
                            entity.runCommand("fog @s remove fluid_fog");
                        }
                    }
                }
            }
        }

        // Part 2: Apply effects to all entities that are currently in the fluid set.
        for (const entityId of entitiesInFluid) {
            const entity = world.getEntity(entityId);

            // if entity is invalid, remove it from all trackers.
            if (!entity || !entity.isValid()) {
                entitiesInFluid.delete(entityId);
                entityLocations.delete(entityId);
                continue;
            }

            const bodyBlock = entity.dimension.getBlock(entity.location);
            const fluidDataInBody = FluidRegistry[bodyBlock?.typeId];

            // if entity is somehow not in a fluid anymore, remove it.
            if (!fluidDataInBody) {
                entitiesInFluid.delete(entityId);
                if (entity.typeId === "minecraft:player") {
                    entity.runCommand("fog @s remove fluid_fog");
                }
                continue;
            }

            // --- Player-Specific Effects (Fog) ---
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

            // --- General Entity Effects ---
            if (entity.isJumping) {
                entity.addEffect("slow_falling", 5, { showParticles: false, amplifier: 1 });
            }
            const velocity = entity.getVelocity();
            if (velocity.y < 0.05) {
                entity.applyKnockback(0, 0, 0, Math.abs(velocity.y) * 0.3 + (fluidDataInBody.buoyancy || 0));
            }

            // Apply all other effects from the handler system
            for (const key in fluidDataInBody) {
                if (effectHandlers[key]) {
                    try {
                        effectHandlers[key](entity, fluidDataInBody);
                    } catch (e) {
                        console.error(`Error applying effect for key '${key}' on entity ${entity.id}: ${e}`);
                    }
                }
            }
        }
    }, 4); // Run the entire check 5 times a second (every 4 ticks)
}

// Initialize the entire system
initialize();

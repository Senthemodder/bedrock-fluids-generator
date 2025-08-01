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

function areEqualPerms(perm1, perm2) {
  if (!perm1 || !perm2) return false;
  const states1 = perm1.getAllStates();
  const states2 = perm2.getAllStates();
  return Object.keys(states1).every((value) => states1[value] === states2[value])
}

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

function fluidUpdate(block) {
    if (!block || !block.isValid() || !block.permutation) return;

    const typeId = block.typeId;
    const queue = Queues[typeId];
    if (!queue) return;

    let currentPermutation = block.permutation;
    const blockStates = currentPermutation.getAllStates();
    const depth = blockStates["lumstudio:depth"];
    const isSourceBlock = depth === MAX_SPREAD_DISTANCE;

    const blockAbove = block.above();
    let isFlowingDownward = (blockAbove?.typeId === typeId);

    const blockBelow = block.below();
    if (blockBelow?.isAir) {
        const fallingFluidPermutation = currentPermutation.withState("lumstudio:depth", isSourceBlock ? MAX_SPREAD_DISTANCE : 8);
        blockBelow.setPermutation(fallingFluidPermutation);
        queue.add(blockBelow);

        if (!isSourceBlock) {
            block.setType('air');
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
        if (neighbor?.typeId === typeId) {
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
        if (blockAbove?.typeId === typeId) {
            canBeSustained = true;
        } else {
            canBeSustained = neighborWithGreaterDepth;
        }
    }

    if (!canBeSustained) {
        block.setType('air');
        return;
    }
    
    if (blockAbove?.typeId === typeId) {
        isFlowingDownward = true;
    }

    if (depth > 1 && !isFlowingDownward) {
        const newDepth = depth - 1;
        for (const dir of DIRECTIONS) {
            const neighbor = block.offset(dir);
            if (neighbor?.isAir) {
                const spreadingPermutation = currentPermutation.withState("lumstudio:depth", newDepth);
                neighbor.setPermutation(spreadingPermutation);
                queue.add(neighbor);
            }
        }
    }

    const hasFluidBelow = block.below().typeId === typeId;
    let newPermutation;
    if (isFlowingDownward) {
        newPermutation = refreshStatesForFalling(currentPermutation, neighborStates, hasFluidBelow, blockAbove?.typeId === typeId, isSourceBlock);
    } else {
        newPermutation = refreshStates(currentPermutation, neighborStates, hasFluidBelow, isSourceBlock, flowDirection);
    }

    if (!areEqualPerms(block.permutation, newPermutation)) {
        block.setPermutation(newPermutation);
    }
}

function placeOrTakeFluid(itemStack, player, hit) {
  const isFluidBucket = itemStack.typeId.endsWith('_bucket');
  if (!hit || !isFluidBucket) return;

  const { face, block } = hit;
  const targetBlock = block.offset(directionToOffset[face]);

  if (targetBlock.isAir) {
    const fluidTypeId = itemStack.typeId.replace('_bucket', '');
    if (!FluidRegistry[fluidTypeId]) return;

    targetBlock.setType(fluidTypeId);
    const fluidPermutation = targetBlock.permutation;
    
    const finalPermutation = fluidPermutation
        .withState("lumstudio:depth", 7)
        .withState("lumstudio:direction", "none");

    targetBlock.setPermutation(finalPermutation);
    
    const queue = Queues[fluidTypeId];
    if (queue) {
        queue.add(targetBlock);
    }

    player.getComponent("equippable").setEquipment("Mainhand", new ItemStack("bucket"));
  }
}

import { effectHandlers } from "./effects/index.js";

function initialize() {
    for (const fluidId in FluidRegistry) {
        Queues[fluidId] = new FluidQueue(fluidUpdate, fluidId);
        Queues[fluidId].run(UPDATES_PER_TICK);
    }

    BlockUpdate.on((update) => {
        if (!update) return;
        const { block } = update;
        if (!block || !block.isValid()) return;

        const queue = Queues[block.typeId];
        if (queue) {
            queue.add(block);
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

    world.beforeEvents.playerInteractWithEntity.subscribe(event => {
        const { player, target } = event;
        if (target.typeId === 'lumstudio:fluid_pickup_entity') {
            event.cancel = true;
            system.run(() => {
                const block = target.dimension.getBlock(target.location);
                if (block && block.hasTag("fluid")) {
                    const bucketItem = new ItemStack(`${block.typeId}_bucket`);
                    player.getComponent("equippable").setEquipment("Mainhand", bucketItem);
                    block.setType('air');
                }
                target.kill();
            });
        }
    });

    const entityLocations = new Map();
    const entitiesInFluid = new Set();
    const pickupEntities = new Map();

    system.runInterval(() => {
        // Cleanup invalid entities from trackers first
        for (const entityId of entitiesInFluid) {
            if (!world.getEntity(entityId)?.isValid()) {
                entitiesInFluid.delete(entityId);
                entityLocations.delete(entityId);
            }
        }
        for (const [loc, id] of pickupEntities.entries()) {
            if (!world.getEntity(id)?.isValid()) {
                pickupEntities.delete(loc);
            }
        }

        for (const player of world.getAllPlayers()) {
            const mainhandItem = player.getComponent("equippable").getEquipment("Mainhand");
            const hit = player.getBlockFromViewDirection({
                includePassableBlocks: false,
                maxDistance: 6,
            });

            const locStr = hit?.block ? `${hit.block.location.x},${hit.block.location.y},${hit.block.location.z}` : null;

            // Despawn any existing pickup entity if conditions are no longer met
            if (pickupEntities.has(player.id) && pickupEntities.get(player.id).location !== locStr) {
                const oldEntity = world.getEntity(pickupEntities.get(player.id).id);
                if (oldEntity) oldEntity.kill();
                pickupEntities.delete(player.id);
            }

            if (hit && mainhandItem?.typeId === 'minecraft:bucket') {
                const { block } = hit;
                const depth = block.permutation?.getState("lumstudio:depth");

                if (block.hasTag("fluid") && depth === MAX_SPREAD_DISTANCE && !pickupEntities.has(player.id)) {
                    const entity = player.dimension.spawnEntity('lumstudio:fluid_pickup_entity', block.center());
                    pickupEntities.set(player.id, { id: entity.id, location: locStr });
                }
            }
        }


        const dimensions = [
            world.getDimension("overworld"),
            world.getDimension("nether"),
            world.getDimension("the_end")
        ];

        for (const dimension of dimensions) {
            if (!dimension) continue;
            for (const entity of dimension.getEntities({})) {
                if (!entity.isValid()) continue; // Early exit for invalid entities

                const lastLocation = entityLocations.get(entity.id);
                const currentLocation = entity.location;

                if (!lastLocation || Math.floor(currentLocation.x) !== Math.floor(lastLocation.x) || Math.floor(currentLocation.y) !== Math.floor(lastLocation.y) || Math.floor(currentLocation.z) !== Math.floor(lastLocation.z)) {
                    entityLocations.set(entity.id, currentLocation);

                    const newBlock = entity.dimension.getBlock(currentLocation);
                    const isInFluid = FluidRegistry[newBlock?.typeId];

                    if (isInFluid) {
                        entitiesInFluid.add(entity.id);
                    } else if (entitiesInFluid.has(entity.id)) {
                        entitiesInFluid.delete(entity.id);
                        if (entity.typeId === "minecraft:player") {
                            entity.runCommand("fog @s remove fluid_fog");
                        }
                    }
                }
            }
        }

        for (const entityId of entitiesInFluid) {
            const entity = world.getEntity(entityId);
            if (!entity) continue;

            const bodyBlock = entity.dimension.getBlock(entity.location);
            const fluidDataInBody = FluidRegistry[bodyBlock?.typeId];

            if (!fluidDataInBody) {
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

            if (entity.isJumping) {
                entity.addEffect("slow_falling", 5, { showParticles: false, amplifier: 1 });
            }
            const velocity = entity.getVelocity();
            if (velocity.y < 0.05) {
                entity.applyKnockback(0, 0, 0, Math.abs(velocity.y) * 0.3 + (fluidDataInBody.buoyancy || 0));
            }

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
    }, 4);
}

initialize();

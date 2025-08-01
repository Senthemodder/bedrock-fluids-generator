import { world, system, Block } from "@minecraft/server";
export { BlockUpdate };

/**
 * @typedef {Object} Offset
 * @property {number} x
 * @property {number} y
 * @property {number} z
 */

const Events = {};

/** @type {Offset[]} */
const Offsets = [
  { x: 0, y: 0, z: 0 },
  { x: 1, y: 0, z: 0 },
  { x: -1, y: 0, z: 0 },
  { x: 0, y: 1, z: 0 },
  { x: 0, y: -1, z: 0 },
  { x: 0, y: 0, z: 1 },
  { x: 0, y: 0, z: -1 }
];

let LastEventId = -1;

class BlockUpdate {
  /** @type {Block} */
  #block;
  /** @type {Block|undefined} */
  #source;

  constructor(data) {
    this.#block = data.block;
    this.#source = data.source;
  }

  get block() {
    return this.#block;
  }

  get source() {
    return this.#source;
  }

  static on(callback) {
    LastEventId++;
    const id = LastEventId + "";
    Events[id] = callback;
    return id;
  }

  static off(id) {
    delete Events[id];
  }

  static trigger(source) {
    for (const offset of Offsets) {
      try {
        const block = source.offset(offset);
        if (block) {
          BlockUpdate.triggerEvents({ block, source });
        }
      } catch (e) {
        // Ignore errors from invalid offsets
      }
    }
  }

  static triggerEvents(data) {
    const update = new BlockUpdate(data);
    for (const id in Events) {
      Events[id](update);
    }
  }
}

const easyTrigger = (data) => {
    if (data.block) {
        BlockUpdate.trigger(data.block);
    }
};

world.afterEvents.playerPlaceBlock.subscribe(easyTrigger);
world.afterEvents.playerBreakBlock.subscribe(easyTrigger);
world.afterEvents.explosion.subscribe((data) => {
    for (const block of data.getImpactedBlocks()) {
        BlockUpdate.trigger(block);
    }
});
world.afterEvents.pistonActivate.subscribe((data) => {
    BlockUpdate.trigger(data.block);
    for (const block of data.piston.getAttachedBlocks()) {
        BlockUpdate.trigger(block);
    }
});

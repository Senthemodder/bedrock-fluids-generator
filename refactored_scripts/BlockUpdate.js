/**
 * @fileoverview This module provides a centralized event system for block updates.
 * It listens to various world events and triggers a single, unified "BlockUpdate" event
 * that other scripts can listen to. This avoids having to subscribe to many different
 * events in every script that needs to react to block changes.
 */

import { world, system, Block } from "@minecraft/server";
export { BlockUpdate };

/**
 * @typedef {Object} Offset - Represents a 3D coordinate offset.
 * @property {number} x
 * @property {number} y
 * @property {number} z
 */

/**
 * A map of registered event listener callbacks.
 * The key is a unique ID, and the value is the callback function.
 * @type {Object.<string, (update: BlockUpdate) => void>}
 */
const Events = {};

/**
 * An array of 3D offsets used to get all 6 neighbors of a block, plus the block itself.
 * @type {Offset[]}
 */
const NEIGHBOR_OFFSETS = [
  { x: 0, y: 0, z: 0 }, // The block itself
  { x: 1, y: 0, z: 0 }, // East
  { x: -1, y: 0, z: 0 },// West
  { x: 0, y: 1, z: 0 }, // Up
  { x: 0, y: -1, z: 0 },// Down
  { x: 0, y: 0, z: 1 }, // South
  { x: 0, y: 0, z: -1 } // North
];

let lastEventId = -1;

/**
 * Represents a block update event, containing the block that was affected
 * and optionally the source of the change.
 */
class BlockUpdate {
  /** @type {Block} */
  #block;
  /** @type {Block|undefined} */
  #source;

  constructor(data) {
    this.#block = data.block;
    this.#source = data.source;
  }

  /** The block that was updated. */
  get block() {
    return this.#block;
  }

  /** The block that caused the update (e.g., a piston or a player). */
  get source() {
    return this.#source;
  }

  /**
   * Registers a callback to be executed when a block update occurs.
   * @param {(update: BlockUpdate) => void} callback The function to call.
   * @returns {string} A unique ID for the listener, which can be used to unsubscribe later.
   */
  static on(callback) {
    lastEventId++;
    const id = lastEventId.toString();
    Events[id] = callback;
    return id;
  }

  /**
   * Removes a previously registered block update listener.
   * @param {string} id The ID returned by the `on` method.
   */
  static off(id) {
    delete Events[id];
  }

  /**
   * Triggers a block update event for a specific block and its neighbors.
   * This is the main function that other modules should call when they cause a block change.
   * @param {Block} sourceBlock The block that is the source of the update.
   */
  static trigger(sourceBlock) {
    if (!sourceBlock || !sourceBlock.isValid()) return;

    for (const offset of NEIGHBOR_OFFSETS) {
      try {
        const targetBlock = sourceBlock.offset(offset);
        if (targetBlock) {
          BlockUpdate.#triggerForAllListeners({ block: targetBlock, source: sourceBlock });
        }
      } catch (e) {
        // This can happen if the offset is out of the world, so we safely ignore it.
      }
    }
  }

  /**
   * Invokes all registered listener callbacks with the update data.
   * @private
   * @param {{ block: Block, source?: Block }} data The data for the event.
   */
  static #triggerForAllListeners(data) {
    const update = new BlockUpdate(data);
    for (const id in Events) {
      try {
        Events[id](update);
      } catch (e) {
        console.error(`Error in BlockUpdate listener (ID: ${id}): ${e}`);
      }
    }
  }

  /**
   * Triggers an update for all neighbors around a specific location.
   * This is used when the source block itself might be invalid (e.g., after being broken).
   * @param {Dimension} dimension The dimension of the update.
   * @param {Vector3} location The location of the update.
   * @param {Block} [sourceBlock=undefined] The optional source block of the change.
   */
  static triggerForNeighborsAt(dimension, location, sourceBlock = undefined) {
      for (const offset of NEIGHBOR_OFFSETS) {
          try {
              const targetLocation = { x: location.x + offset.x, y: location.y + offset.y, z: location.z + offset.z };
              const targetBlock = dimension.getBlock(targetLocation);
              if (targetBlock) {
                  BlockUpdate.#triggerForAllListeners({ block: targetBlock, source: sourceBlock });
              }
          } catch (e) {
              // Ignore errors for out-of-world locations
          }
      }
  }
}

// --- Event Subscription ---
// We subscribe to all relevant world events to automatically trigger our custom BlockUpdate event.

/**
 * A simple helper function to trigger an update from events that provide a valid `block` property.
 * @param {{ block: Block }} eventData The event data from the Minecraft API.
 */
const easyTrigger = (eventData) => {
    if (eventData.block) {
        BlockUpdate.trigger(eventData.block);
    }
};

// Player-related block changes
world.afterEvents.playerPlaceBlock.subscribe(easyTrigger);

// Special handling for playerBreakBlock where the event's block is no longer valid.
world.afterEvents.playerBreakBlock.subscribe((eventData) => {
    BlockUpdate.triggerForNeighborsAt(eventData.dimension, eventData.block.location, eventData.player);
});

// Redstone-related block changes
world.afterEvents.buttonPush.subscribe(easyTrigger);
world.afterEvents.leverAction.subscribe(easyTrigger);
world.afterEvents.pressurePlatePop.subscribe(easyTrigger);
world.afterEvents.pressurePlatePush.subscribe(easyTrigger);
world.afterEvents.tripWireTrip.subscribe(easyTrigger);

// Piston-related changes
world.afterEvents.pistonActivate.subscribe((eventData) => {
    // Trigger for the piston block itself
    BlockUpdate.trigger(eventData.block);
    // Trigger for all blocks moved by the piston
    for (const block of eventData.piston.getAttachedBlocks()) {
        BlockUpdate.trigger(block);
    }
});

// Environmental changes
world.afterEvents.explosion.subscribe((eventData) => {
    for (const block of eventData.getImpactedBlocks()) {
        BlockUpdate.trigger(block);
    }
});

world.afterEvents.projectileHitBlock.subscribe((eventData) => {
    BlockUpdate.trigger(eventData.getBlockHit().block);
});


// NOTE: The code that attempted to override Block.prototype.setType and other
// native methods has been REMOVED. This practice, known as monkey-patching,
// is not supported by the Minecraft Scripting API and was the source of the
// "TypeError: not a function" error. Scripts that manually change blocks
// via setType or setPermutation must now manually call BlockUpdate.trigger()
// afterwards if they want to notify the system of the change.
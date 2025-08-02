import { system } from "@minecraft/server";
import { FluidRegistry } from "./registry.js";

/**
 * A class that manages a queue of fluid blocks to be updated, respecting a
 * configurable tick delay for performance and custom flow speeds.
 */
export class FluidQueue {
    #queue = new Set();
    #updateCallback;
    #fluidId;
    #tickDelay;

    /**
     * @param {(block: Block) => void} updateCallback The function to call for each block update.
     * @param {string} fluidId The identifier of the fluid this queue manages.
     */
    constructor(updateCallback, fluidId) {
        this.#updateCallback = updateCallback;
        this.#fluidId = fluidId;
        
        // Get the specific tick delay for this fluid from the registry, default to 5.
        this.#tickDelay = FluidRegistry[this.#fluidId]?.tick_delay || 5;
    }

    /**
     * Adds a block to the update queue if it's not already present.
     * @param {Block} block The block to add.
     */
    add(block) {
        if (!block || !block.isValid()) return;
        // Use a location string as a unique key to prevent duplicate processing.
        this.#queue.add(block.location.toString());
    }

    /**
     * Starts the processing loop for this queue.
     * @param {number} updatesPerInterval The number of blocks to process each time the interval runs.
     */
    run(updatesPerInterval) {
        system.runInterval(() => {
            if (this.#queue.size === 0) return;

            const itemsToProcess = Array.from(this.#queue).slice(0, updatesPerInterval);
            this.#queue = new Set(Array.from(this.#queue).slice(updatesPerInterval));

            for (const locationString of itemsToProcess) {
                try {
                    // Re-fetch the block from its location to ensure it's still valid.
                    const location = this.#stringToLocation(locationString);
                    const block = world.getDimension("overworld").getBlock(location); // Note: Assumes overworld, might need enhancement for multi-dim support

                    if (block && block.isValid() && block.typeId === this.#fluidId) {
                        this.#updateCallback(block);
                    }
                } catch (e) {
                    // This can happen if the block becomes invalid during processing.
                    // It's safe to ignore and continue.
                }
            }
        }, this.#tickDelay);
    }

    /**
     * Converts a location string back into a Vector3 object.
     * @param {string} locString The string from location.toString().
     * @returns {{x: number, y: number, z: number}}
     * @private
     */
    #stringToLocation(locString) {
        const [x, y, z] = locString.split(',').map(Number);
        return { x, y, z };
    }
}
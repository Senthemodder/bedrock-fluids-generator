import { system, world } from "@minecraft/server";
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
     * @param {(block: import("@minecraft/server").Block) => void} updateCallback The function to call for each block update.
     * @param {string} fluidId The identifier of the fluid this queue manages.
     */
    constructor(updateCallback, fluidId) {
        this.#updateCallback = updateCallback;
        this.#fluidId = fluidId;
        this.#tickDelay = FluidRegistry[this.#fluidId]?.tick_delay || 5;
    }

    /**
     * Creates a standardized location string for use as a unique key.
     * @param {import("@minecraft/server").Block} block The block.
     * @returns {string} A string formatted as "x,y,z,dimensionId".
     */
    #getBlockLocationString(block) {
        return `${block.location.x},${block.location.y},${block.location.z},${block.dimension.id}`;
    }

    /**
     * Adds a block to the update queue if it's not already present.
     * @param {import("@minecraft/server").Block} block The block to add.
     */
    add(block) {
        if (!block || !block.isValid()) return;
        this.#queue.add(this.#getBlockLocationString(block));
    }

    /**
     * Starts the processing loop for this queue.
     * @param {number} updatesPerInterval The number of blocks to process each time the interval runs.
     */
    run(updatesPerInterval) {
        system.runInterval(() => {
            if (this.#queue.size === 0) return;

            const itemsToProcess = Array.from(this.#queue).slice(0, updatesPerInterval);
            
            // Create a new set for the remaining items
            const remainingItems = new Set(Array.from(this.#queue));
            itemsToProcess.forEach(item => remainingItems.delete(item));
            this.#queue = remainingItems;


            for (const locationString of itemsToProcess) {
                try {
                    const parts = locationString.split(',');
                    const location = { x: +parts[0], y: +parts[1], z: +parts[2] };
                    const dimensionId = parts[3];
                    
                    const dimension = world.getDimension(dimensionId);
                    const block = dimension.getBlock(location);

                    if (block && block.isValid() && block.typeId === this.#fluidId) {
                        this.#updateCallback(block);
                    }
                } catch (e) {
                    // It's safe to ignore and continue.
                }
            }
        }, this.#tickDelay);
    }
}

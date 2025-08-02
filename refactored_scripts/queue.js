import { system, world, Block } from "@minecraft/server";
import { FluidRegistry } from "./registry.js";

/**
 * A robust, timed queue system for processing fluid block updates.
 * This version uses a single Set as the source of truth to prevent state corruption.
 */
export class FluidQueue {
    /** @type {Set<string>} A set of unique block location strings to process. */
    #queue = new Set();
    /** @type {(block: import("@minecraft/server").Block) => void} The callback to run for each block. */
    #updateCallback;
    /** @type {string} The identifier of the fluid this queue manages (e.g., "lumstudio:acid"). */
    #fluidId;
    /** @type {number} The delay in ticks between each processing interval. */
    #tickDelay;

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
     * Adds a block to the update queue.
     * @param {import("@minecraft/server").Block} block The block to add.
     */
    add(block) {
        try {
            // This is the only place items are added to the queue.
            if (block instanceof Block && block.isValid()) {
                this.#queue.add(this.#getBlockLocationString(block));
            }
        } catch (e) {
            // This catch block is a safeguard against unstable block objects.
            console.warn(`[FluidQueue] Failed to add a block to the queue. It may have been unstable. Error: ${e.message}`);
        }
    }

    /**
     * Starts the processing loop for this queue.
     * @param {number} updatesPerInterval The maximum number of blocks to process each time the interval runs.
     */
    run(updatesPerInterval) {
        system.runInterval(() => {
            if (this.#queue.size === 0) {
                return;
            }

            // Take a snapshot of the current queue and then immediately clear it.
            // This is a critical step to prevent race conditions and ensure stability.
            const itemsToProcess = Array.from(this.#queue).slice(0, updatesPerInterval);
            this.#queue.clear();

            for (const locationString of itemsToProcess) {
                try {
                    const parts = locationString.split(',');
                    const location = { x: +parts[0], y: +parts[1], z: +parts[2] };
                    const dimensionId = parts[3];
                    
                    const dimension = world.getDimension(dimensionId);
                    const block = dimension.getBlock(location);

                    // Final check to ensure the block is still a valid fluid block before processing.
                    if (block && block.isValid() && block.typeId === this.#fluidId) {
                        this.#updateCallback(block);
                    }
                } catch (e) {
                    // It's safe to ignore errors here, as the block may have become invalid during the tick delay.
                }
            }
        }, this.#tickDelay);
    }
}

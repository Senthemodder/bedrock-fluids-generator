import { system, world } from "@minecraft/server";
import { FluidRegistry } from "./registry.js";

/**
 * A robust, timed queue system for processing fluid block updates.
 */
export class FluidQueue {
    #queue = [];
    #queuedItems = new Set();
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
     * Adds a block to the update queue. This is the function we are diagnosing.
     * @param {import("@minecraft/server").Block} block The block to add.
     */
    add(block) {
        try {
            if (!block || !block.isValid()) {
                // console.warn("[FluidQueue] Ignored an invalid block passed to add().");
                return;
            }

            const locationString = this.#getBlockLocationString(block);
            
            if (this.#queuedItems.has(locationString)) {
                return;
            }

            this.#queuedItems.add(locationString);
            this.#queue.push(locationString);

        } catch (e) {
            // THIS IS THE DIAGNOSTIC BLOCK
            console.error("--- [FluidQueue] CRITICAL ERROR IN ADD METHOD ---");
            console.error(`Error: ${e.message}`);
            console.error(`Stack: ${e.stack}`);
            // The following line will attempt to serialize the object that was passed in.
            // This will help us see if it's a real block or something else.
            try {
                console.error(`Problematic "block" object: ${JSON.stringify(block, null, 2)}`);
            } catch (stringifyError) {
                console.error(`Could not stringify the "block" object. It might be a circular structure or an unstable native object.`);
            }
            console.error("-------------------------------------------------");
        }
    }

    /**
     * Starts the processing loop for this queue.
     * @param {number} updatesPerInterval The maximum number of blocks to process each time the interval runs.
     */
    run(updatesPerInterval) {
        system.runInterval(() => {
            if (this.#queue.length === 0) return;

            const itemsToProcessCount = Math.min(this.#queue.length, updatesPerInterval);

            for (let i = 0; i < itemsToProcessCount; i++) {
                const locationString = this.#queue.shift();
                if (!locationString) continue;

                this.#queuedItems.delete(locationString);

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
                    // This is a safe failure, can be ignored.
                }
            }
        }, this.#tickDelay);
    }
}
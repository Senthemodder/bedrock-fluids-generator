# Troubleshooting Custom Fluid Placement

This document outlines the common reasons why custom fluids may fail to be placed with a bucket or fail to flow when placed with commands.

---

## Issue 1: Cannot Place Fluids with a Bucket

If you right-click with your custom fluid bucket and nothing happens, the script is silently stopping because a condition is not being met. Here are the most common causes, in order of likelihood:

### 1. Mismatched Item/Block Identifiers

The script requires a strict naming convention to link the bucket item to the fluid block.

*   **Bucket Item ID:** The identifier for your bucket in its item definition file must end with `_bucket`.
    *   *Example:* `lumstudio:acid_bucket`
*   **Fluid Block ID:** The identifier for your fluid block in its block definition file must be the exact name of the bucket ID *without* the `_bucket` suffix.
    *   *Example:* `lumstudio:acid`

If these names do not match perfectly, the script cannot determine which block to place.

### 2. Fluid Not Registered

The script needs to know the properties of the fluid it's placing (e.g., buoyancy, damage, fog color). This information is stored in `refactored_scripts/registry.js`.

*   **Check `registry.js`:** Ensure there is an entry in the `FluidRegistry` object that matches the fluid block's ID.
*   **Example:** If your block is `lumstudio:acid`, your `registry.js` must contain an entry like this:
    ```javascript
    export const FluidRegistry = {
        "lumstudio:acid": {
            // ... properties for acid
        },
        // ... other fluids
    };
    ```
If the entry is missing, the script will not place the block because it has no data for it.

### 3. Target Block is Not Air

The script is intentionally designed to only place fluids in empty blocks.

*   If you are trying to place a fluid inside a solid block (like stone or dirt), the action will be correctly ignored. Ensure you are targeting an air block.

---

## Issue 2: Fluids Placed with `/setblock` Do Not Flow

When you use a command like `/setblock` to place a fluid and it doesn't flow, it's because the command bypasses the scripting engine.

### The Cause: Bypassing the Fluid Engine

The fluid simulation is managed by a `FluidQueue`. A block only gets added to this queue to be processed when the script is explicitly told about it.

*   **Bucket Placement:** When you use a bucket, the `placeFluidWithBucket` function manually adds the new block to the queue, starting the simulation.
*   **`/setblock` Placement:** The `/setblock` command places the block directly into the world without firing any events that the scripting engine is listening for. The script is never notified about the new block, so it is never added to the queue and never processed.

### The Workaround: Forcing a Block Update

To make a command-placed fluid flow, you must manually trigger an update on an adjacent block. This causes the `BlockUpdate.js` script to run, discover your new fluid block, and add it to the queue.

1.  **Place the fluid source with the command:**
    ```
    /setblock ~ ~ ~ lumstudio:acid
    ```
2.  **Force an update by placing and immediately removing a block next to it:**
    ```
    /setblock ~1 ~ ~ stone
    /setblock ~1 ~ ~ air
    ```

This action of placing and breaking the `stone` block will "wake up" the fluid engine, which will then find and start the simulation for your acid block.

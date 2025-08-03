/**
 * @fileoverview Generates the complete fluid geometry JSON dynamically.
 * This ensures UV maps are correct and provides a single source of truth for the fluid's visual shape.
 */

export class FluidGeometryGenerator {
    constructor() {
        this.geometry = {
            "format_version": "1.12.0",
            "minecraft:geometry": []
        };
    }

    /**
     * Creates the geometry definition for a single fluid level.
     * @param {number} level The fluid level (1-8). A level of 8 is a full block.
     * @returns {object} The geometry description object for the specified level.
     */
    createGeometryForLevel(level) {
        const identifier = `geometry.fluid.${level}`;
        const height = level * 2; // Each level is 2 pixels high in a 16x16 texture space.

        const description = {
            "identifier": identifier,
            "texture_width": 16,
            "texture_height": 16,
            "visible_bounds_width": 3,
            "visible_bounds_height": 2.5,
            "visible_bounds_offset": [0, 0.75, 0]
        };

        // All faces are generated with correct UV mapping based on the calculated height.
        const bones = [
            { "name": "fluid", "pivot": [0, 0, 0] },
            { "name": "up", "parent": "fluid", "pivot": [0, 0, 0], "cubes": [{"origin": [-8, height, -8], "size": [16, 0, 16], "uv": {"up": {"uv": [16, 16], "uv_size": [-16, -16]}}}]},
            { "name": "down", "parent": "fluid", "pivot": [0, 0, 0], "cubes": [{"origin": [-8, 0, -8], "size": [16, 0, 16], "uv": {"down": {"uv": [16, 16], "uv_size": [-16, -16]}}}]},
            { "name": "north", "parent": "fluid", "pivot": [0, 0, 0], "cubes": [{"origin": [-8, 0, -8], "size": [16, height, 0], "uv": {"north": {"uv": [0, 0], "uv_size": [16, height]}}}]},
            { "name": "south", "parent": "fluid", "pivot": [0, 0, 0], "cubes": [{"origin": [-8, 0, 8], "size": [16, height, 0], "uv": {"south": {"uv": [0, 0], "uv_size": [16, height]}}}]},
            { "name": "east", "parent": "fluid", "pivot": [0, 0, 0], "cubes": [{"origin": [-8, 0, -8], "size": [0, height, 16], "uv": {"east": {"uv": [0, 0], "uv_size": [16, height]}}}]},
            { "name": "west", "parent": "fluid", "pivot": [0, 0, 0], "cubes": [{"origin": [8, 0, -8], "size": [0, height, 16], "uv": {"west": {"uv": [0, 0], "uv_size": [16, height]}}}]}
        ];

        // These special bones are for creating the "waterfall" connection effect to adjacent fluid blocks.
        if (level > 1 && level < 8) {
            // For intermediate levels, the connection point is halfway up.
            const halfHeight = Math.floor(height / 2);
            const halfOriginY = height - halfHeight;
            bones.push(
                { "name": "north_half", "parent": "fluid", "pivot": [0, 0, 0], "cubes": [{"origin": [-8, halfOriginY, -8], "size": [16, halfHeight, 0], "uv": {"north": {"uv": [0, 0], "uv_size": [16, halfHeight]}}}]},
                { "name": "south_half", "parent": "fluid", "pivot": [0, 0, 0], "cubes": [{"origin": [-8, halfOriginY, 8], "size": [16, halfHeight, 0], "uv": {"south": {"uv": [0, 0], "uv_size": [16, halfHeight]}}}]},
                { "name": "east_half", "parent": "fluid", "pivot": [0, 0, 0], "cubes": [{"origin": [-8, halfOriginY, -8], "size": [0, halfHeight, 16], "uv": {"east": {"uv": [0, 0], "uv_size": [16, halfHeight]}}}]},
                { "name": "west_half", "parent": "fluid", "pivot": [0, 0, 0], "cubes": [{"origin": [8, halfOriginY, -8], "size": [0, halfHeight, 16], "uv": {"west": {"uv": [0, 0], "uv_size": [16, halfHeight]}}}]}
            );
        } else if (level === 8) {
            // For a full block (source), the connection point is different to handle falling sources.
             bones.push(
                { "name": "north2", "parent": "fluid", "pivot": [0, 0, 0], "cubes": [{"origin": [-8, 11, -8], "size": [16, 5, 0], "uv": {"north": {"uv": [0, 0], "uv_size": [16, 5]}}}]},
                { "name": "south2", "parent": "fluid", "pivot": [0, 0, 0], "cubes": [{"origin": [-8, 11, 8], "size": [16, 5, 0], "uv": {"south": {"uv": [0, 0], "uv_size": [16, 5]}}}]},
                { "name": "east2", "parent": "fluid", "pivot": [0, 0, 0], "cubes": [{"origin": [-8, 11, -8], "size": [0, 5, 16], "uv": {"east": {"uv": [0, 0], "uv_size": [16, 5]}}}]},
                { "name": "west2", "parent": "fluid", "pivot": [0, 0, 0], "cubes": [{"origin": [8, 11, -8], "size": [0, 5, 16], "uv": {"west": {"uv": [0, 0], "uv_size": [16, 5]}}}]}
            );
        }

        return {
            description: description,
            bones: bones
        };
    }

    /**
     * Generates all 8 fluid level geometries and adds them to the main object.
     * @returns {FluidGeometryGenerator} The current instance for chaining.
     */
    generateAll() {
        for (let i = 1; i <= 8; i++) {
            this.geometry["minecraft:geometry"].push(this.createGeometryForLevel(i));
        }
        return this;
    }

    /**
     * Returns the final, complete geometry JSON object.
     * @returns {object}
     */
    build() {
        return this.geometry;
    }
}

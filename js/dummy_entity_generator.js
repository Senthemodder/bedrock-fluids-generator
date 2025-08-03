/**
 * @fileoverview This module is dedicated to generating all the necessary files for a
 * standards-compliant "dummy" entity in Minecraft Bedrock Edition.
 * It follows the "Beginner's Guide to Dummy Entities" to ensure correctness.
 */

/**
 * Creates all the necessary JSON files and assets for a complete dummy entity.
 * A dummy entity is an invisible, non-interacting entity used for mechanics,
 * data storage, or as a location marker.
 *
 * @param {object} config - The configuration for the dummy entity.
 * @param {string} config.identifier - The unique identifier for the entity (e.g., "lumstudio:my_dummy").
 * @returns {{
 *   behavior: object,
 *   resource: object,
 *   geometry: object,
 *   render_controller: object
 * }} An object containing the JSON for the four required files.
 */
function createDummyEntity(config) {
    if (!config || !config.identifier) {
        throw new Error("Dummy entity configuration must include an 'identifier'.");
    }

    const { identifier } = config;

    // --- Step 1: Behavior Entity (BP/entities/dummy.json) ---
    // Defines the entity's server-side behavior.
    // It has no gravity, no collision, and cannot be pushed or damaged.
    const behaviorEntity = {
        "format_version": "1.16.0",
        "minecraft:entity": {
            "description": {
                "identifier": identifier,
                "is_summonable": true,
                "is_spawnable": false,
                "is_experimental": false
            },
            "components": {
                // Allows the entity to "breathe" anywhere, preventing it from taking drowning damage.
                "minecraft:breathable": {
                    "breathes_water": true
                },
                // Removes all physics simulation for this entity.
                "minecraft:physics": {
                    "has_gravity": false,
                    "has_collision": false
                },
                // Moves the hitbox far away so it cannot be hit by players.
                "minecraft:custom_hit_test": {
                    "hitboxes": [
                        {
                            "pivot": [0, 100, 0], // High up in the sky
                            "width": 0,
                            "height": 0
                        }
                    ]
                },
                // Prevents the entity from taking damage from any source.
                "minecraft:damage_sensor": {
                    "triggers": {
                        "deals_damage": false
                    }
                },
                // Makes the entity immovable by other entities or pistons.
                "minecraft:pushable": {
                    "is_pushable": false,
                    "is_pushable_by_piston": false
                },
                // A tiny collision box to prevent any unwanted interactions.
                "minecraft:collision_box": {
                    "width": 0.0001,
                    "height": 0.0001
                }
            }
        }
    };

    // --- Step 2: Resource Entity (RP/entity/dummy.json) ---
    // Defines the entity's client-side appearance and resources.
    const resourceEntity = {
        "format_version": "1.10.0",
        "minecraft:client_entity": {
            "description": {
                "identifier": identifier,
                "materials": {
                    "default": "entity_alphatest" // Standard material for entities with transparency
                },
                "geometry": {
                    "default": "geometry.dummy" // Links to the empty geometry file
                },
                "render_controllers": ["controller.render.dummy"], // Links to the render controller
                "textures": {
                    "default": "textures/entity/dummy" // Points to a non-existent (or transparent) texture
                }
            }
        }
    };

    // --- Step 3: Geometry (RP/models/entity/dummy.json) ---
    // Defines an empty 3D model, making the entity invisible.
    const geometry = {
        "format_version": "1.12.0",
        "minecraft:geometry": [
            {
                "description": {
                    "identifier": "geometry.dummy", // The identifier used by the resource entity
                    "texture_width": 16,
                    "texture_height": 16
                }
                // No bones or cubes are defined, resulting in an empty model.
            }
        ]
    };

    // --- Step 4: Render Controller (RP/render_controllers/dummy.json) ---
    // Defines how the entity should be rendered. In this case, it renders an empty model.
    const renderController = {
        "format_version": "1.10.0",
        "render_controllers": {
            "controller.render.dummy": {
                "geometry": "Geometry.default", // Uses the default geometry from the resource entity
                "textures": ["Texture.default"], // Uses the default texture
                "materials": [
                    {
                        "*": "Material.default" // Uses the default material
                    }
                ]
            }
        }
    };

    return {
        behavior: behaviorEntity,
        resource: resourceEntity,
        geometry: geometry,
        render_controller: renderController
    };
}

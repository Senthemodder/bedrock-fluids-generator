// --- CORE GENERATOR FUNCTIONS ---

/**
 * Generates the content for the dynamic registry.js file.
 * @param {object} config The fluid configuration from the user.
 * @returns {string} The string content of the registry.js file.
 */
function getRegistryScript(config) {
    const fluidId = config.id;
    const registry = {
        [fluidId]: {
            damage: config.damage,
            fog: config.fogColor.substring(1), // Store hex without '#'
            buoyancy: config.buoyancy,
            tick_delay: config.tickDelay,
            boat: config.supportsBoats,
        }
    };

    if (config.burnsEntities) {
        registry[fluidId].burnTime = 5; // Default burn time of 5 seconds
    }

    if (config.effect && config.effect !== "") {
        registry[fluidId].effect = config.effect;
    }

    return `export const FluidRegistry = ${JSON.stringify(registry, null, 2)};`;
}

function getManifestJson(packName, packDesc, type, rpUuid) {
    const headerUuid = uuid.v4();
    const base = {
        format_version: 2,
        header: {
            name: packName,
            description: packDesc,
            uuid: headerUuid,
            version: [1, 0, 0],
            min_engine_version: [1, 20, 60]
        },
        modules: []
    };

    if (type === 'resources') {
        base.modules.push({
            description: "Resources",
            type: "resources",
            uuid: uuid.v4(),
            version: [1, 0, 0]
        });
    } else { // Behavior Pack
        base.modules.push({
            description: "Data",
            type: "data",
            uuid: uuid.v4(),
            version: [1, 0, 0]
        });
        base.modules.push({
            description: "Scripts",
            type: "script",
            language: "javascript",
            uuid: uuid.v4(),
            version: [1, 0, 0],
            entry: "scripts/main.js"
        });
        base.dependencies = [
            {
                "module_name": "@minecraft/server",
                "version": "2.0.0"
            },
            {
                "module_name": "@minecraft/server-ui",
                "version": "2.0.0"
            },
            {
                "uuid": rpUuid,
                "version": [1, 0, 0]
            }
        ];
    }
    return base;
}

/**
 * Creates the JSON for the fluid's block definition file based on the whatever.json template.
 * @param {object} config The fluid configuration from the frontend.
 * @returns {object}
 */
function getBlockJson(config) {
    const fluidId = config.id;
    const textureName = fluidId.replace(':', '_');
    const flowingTexture = `flowing_${textureName}`;

    const template = {
      "format_version": "1.21.40",
      "minecraft:block": {
        "description": {
          "identifier": fluidId,
          "menu_category": {
            "category": "none"
          },
          "states": {
            "lumstudio:invisible_east": [0,1,2],
            "lumstudio:invisible_west": [0,1,2],
            "lumstudio:invisible_north": [0,1,2],
            "lumstudio:invisible_south": [0,1,2],
            "lumstudio:invisible_up": [0,1],
            "lumstudio:invisible_down": [0,1],
            "lumstudio:depth": [1, 2, 3, 4, 5, 6, 7, 8],
            "lumstudio:direction": ["none","s","n","e","w","ns","ne","se","sw"]
          }
        },
        "components": {
          "minecraft:light_dampening": 0,
          "minecraft:collision_box": false,
          "minecraft:selection_box": false,
          "minecraft:destructible_by_explosion": false,
          "minecraft:material_instances": {
            "*": {
              "texture": textureName,
              "render_method": "blend",
              "ambient_occlusion": false,
              "face_dimming": false
            }
          },
          "minecraft:loot": "loot_tables/empty.json",
          "tag:custom_fluid": {},
          "tag:fluid": {}
        },
        "permutations": []
      }
    };

    if (config.lightLevel > 0) {
        template["minecraft:block"].components["minecraft:light_emission"] = config.lightLevel;
    }

    const directions = ["none", "s", "n", "e", "w", "ns", "ne", "se", "sw"];
    const rotations = {
        "e": [0, 90, 0],
        "s": [0, 180, 0],
        "w": [0, -90, 0],
        "ne": [0, 180, 0],
        "se": [0, 90, 0],
        "nw": [0, -90, 0]
    };

    for (let depth = 1; depth <= 8; depth++) {
        for (const dir of directions) {
            const geoLevel = depth === 8 ? 8 : depth;
            const upTexture = (dir === "none" && depth === 7) ? textureName : flowingTexture;

            const boneVisibility = {
                "up": "q.block_state('lumstudio:invisible_up') == 0",
                "down": "q.block_state('lumstudio:invisible_down') == 0",
                "north": "q.block_state('lumstudio:invisible_north') == 0",
                "east": "q.block_state('lumstudio:invisible_east') == 0",
                "west": "q.block_state('lumstudio:invisible_west') == 0",
                "south": "q.block_state('lumstudio:invisible_south') == 0"
            };

            // The "half" bones only exist on fluid levels 2-7, so only add visibility rules for them then.
            if (depth > 1 && depth < 8) {
                boneVisibility["north_half"] = "q.block_state('lumstudio:invisible_north') == 1";
                boneVisibility["east_half"] = "q.block_state('lumstudio:invisible_east') == 1";
                boneVisibility["west_half"] = "q.block_state('lumstudio:invisible_west') == 1";
                boneVisibility["south_half"] = "q.block_state('lumstudio:invisible_south') == 1";
            }

            const permutation = {
                "condition": `q.block_state('lumstudio:depth') == ${depth} && q.block_state('lumstudio:direction') == '${dir}'`,
                "components": {
                    "minecraft:geometry": {
                        "identifier": `geometry.fluid.${geoLevel}`,
                        "bone_visibility": boneVisibility
                    },
                    "minecraft:material_instances": {
                        "*": {
                            "texture": textureName,
                            "render_method": "blend",
                            "face_dimming": false,
                            "ambient_occlusion": false
                        },
                        "up": {
                            "texture": upTexture,
                            "render_method": "blend",
                            "face_dimming": false,
                            "ambient_occlusion": false
                        }
                    }
                }
            };

            if (rotations[dir]) {
                permutation.components["minecraft:transformation"] = { "rotation": rotations[dir] };
            }
            
            template["minecraft:block"].permutations.push(permutation);
        }
    }

    return template;
}

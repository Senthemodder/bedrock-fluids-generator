# Beginner’s Guide to Dummy Entities in Minecraft Bedrock Edition

Dummy entities are invisible entities in Minecraft Bedrock Edition used for behind-the-scenes gameplay mechanics. They are non-rendered, non-interactable entities that serve as versatile tools for custom add-ons, data management, and game logic. This guide covers their uses and how to create them.

## Uses of Dummy Entities

- **Data Storage**: Attach tags to store game data (e.g., scores, states), similar to Armor Stands in Java Edition.
- **Named Entity**: Use name tags with `/execute` commands to trigger actions with custom display names.
- **Location Marker**: Run `/execute` at a dummy’s position to work with relative coordinates.
- **Waypoint**: Make entities aggressive toward a dummy to guide them to specific locations.

## Creating Dummy Entities

### Behavior Entity (BP/entities/dummy.json)

Defines the entity’s behavior. Key features: no damage, no collision, and immune to pushing.

```json
{
	"format_version": "1.16.0",
	"minecraft:entity": {
		"description": {
			"identifier": "wiki:dummy",
			"is_summonable": true,
			"is_spawnable": false,
			"is_experimental": false
		},
		"components": {
			"minecraft:breathable": {
				"breathes_water": true
			},
			"minecraft:physics": {
				"has_gravity": false,
				"has_collision": false
			},
			"minecraft:custom_hit_test": {
				"hitboxes": [
					{
						"pivot": [0, 100, 0],
						"width": 0,
						"height": 0
					}
				]
			},
			"minecraft:damage_sensor": {
				"triggers": {
					"deals_damage": false
				}
			},
			"minecraft:pushable": {
				"is_pushable": false,
				"is_pushable_by_piston": false
			},
			"minecraft:collision_box": {
				"width": 0.0001,
				"height": 0.0001
			}
		}
	}
}
```

**Note**: For zero collision (e.g., placing blocks at the entity’s position), use the `arrow` runtime identifier, but be aware of potential side effects.

### Resource Entity (RP/entity/dummy.json)

Defines the client-side entity, linking to geometry, textures, and render controllers.

```json
{
	"format_version": "1.10.0",
	"minecraft:client_entity": {
		"description": {
			"identifier": "wiki:dummy",
			"materials": {
				"default": "entity_alphatest"
			},
			"geometry": {
				"default": "geometry.dummy"
			},
			"render_controllers": ["controller.render.dummy"],
			"textures": {
				"default": "textures/entity/dummy"
			}
		}
	}
}
```

### Geometry (RP/models/entity/dummy.json)

Defines an empty geometry for the invisible entity.

```json
{
	"format_version": "1.12.0",
	"minecraft:geometry": [
		{
			"description": {
				"identifier": "geometry.dummy",
				"texture_width": 16,
				"texture_height": 16
			}
		}
	]
}
```

### Render Controller (Optional, RP/render_controllers/dummy.json)

Links geometry, textures, and materials for rendering (often empty for dummies).

```json
{
	"format_version": "1.10.0",
	"render_controllers": {
		"controller.render.dummy": {
			"geometry": "Geometry.default",
			"textures": ["Texture.default"],
			"materials": [
				{
					"*": "Material.default"
				}
			]
		}
	}
}
```

### Texture (Optional)

Use a blank texture or leave the texture path empty. Create a 16x16 transparent PNG in Blockbench if needed.

## Tips

- **File Structure**: Place files in the correct Behavior Pack (BP) and Resource Pack (RP) folders.
- **Testing**: Summon the entity with `/summon wiki:dummy` to verify functionality.
- **Customization**: Adjust components (e.g., add `minecraft:timer` for timed behaviors) based on your needs.
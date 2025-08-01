# Scripting API Documentation

## Direction Enumeration
- **Date**: 02/10/2025
- **Description**: General-purpose relative direction enumeration.

### Constants
- **Down**: `"Down"` - Returns `@minecraft/server.Block` beneath (y - 1).
- **East**: `"East"` - Returns `@minecraft/server.Block` to the east (x + 1).
- **North**: `"North"` - Returns `@minecraft/server.Block` to the north (z + 1).
- **South**: `"South"` - Returns `@minecraft/server.Block` to the south (z - 1).
- **Up**: `"Up"` - Returns `@minecraft/server.Block` above (y + 1).
- **West**: `"West"` - Returns `@minecraft/server.Block` to the west (x - 1).

## Block Class
- **Date**: 06/11/2025
- **Description**: Represents a block in a dimension at unique X, Y, Z coordinates. Updated significantly in version 1.17.10.21.

### Properties
- **dimension**: `read-only Dimension` - Dimension of the block.
- **isAir**: `read-only boolean` - True if block is air (empty space). Throws `LocationInUnloadedChunkError`, `LocationOutOfWorldBoundariesError`.
- **isLiquid**: `read-only boolean` - True if block is liquid (e.g., water, lava). Throws `LocationInUnloadedChunkError`, `LocationOutOfWorldBoundariesError`.
- **isValid**: `read-only boolean` - True if block reference is valid.
- **isWaterlogged**: `read-only boolean` - True if block has water. Throws `LocationInUnloadedChunkError`, `LocationOutOfWorldBoundariesError`.
- **localizationKey**: `read-only string` - Localization key for block name in .lang files. Throws `LocationInUnloadedChunkError`, `LocationOutOfWorldBoundariesError`.
- **location**: `read-only Vector3` - Block coordinates.
- **permutation**: `read-only BlockPermutation` - Block configuration data. Throws `LocationInUnloadedChunkError`, `LocationOutOfWorldBoundariesError`.
- **type**: `read-only BlockType` - Block type. Throws `LocationInUnloadedChunkError`, `LocationOutOfWorldBoundariesError`.
- **typeId**: `read-only string` - Block type identifier. Throws `LocationInUnloadedChunkError`, `LocationOutOfWorldBoundariesError`.
- **x**: `read-only number` - X coordinate.
- **y**: `read-only number` - Y coordinate.
- **z**: `read-only number` - Z coordinate.

### Methods
- **above(steps?: number): Block | undefined** - Returns block above (Y+). Throws `LocationInUnloadedChunkError`, `LocationOutOfWorldBoundariesError`.
- **below(steps?: number): Block | undefined** - Returns block below (Y-). Throws `LocationInUnloadedChunkError`, `LocationOutOfWorldBoundariesError`.
- **bottomCenter(): Vector3** - Returns center of block on X, Z axis.
- **canBeDestroyedByLiquidSpread(liquidType: LiquidType): boolean** - Checks if block is removed by liquid. Throws `Error`, `LocationInUnloadedChunkError`, `LocationOutOfWorldBoundariesError`.
- **canContainLiquid(liquidType: LiquidType): boolean** - Checks if block can be waterlogged. Throws `Error`, `LocationInUnloadedChunkError`, `LocationOutOfWorldBoundariesError`.
- **center(): Vector3** - Returns center of block on X, Y, Z axis.
- **east(steps?: number): Block | undefined** - Returns block to east (X+). Throws `LocationInUnloadedChunkError`, `LocationOutOfWorldBoundariesError`.
- **getComponent(componentId: T): BlockComponentReturnType<T> | undefined** - Gets block component. Throws `LocationInUnloadedChunkError`, `LocationOutOfWorldBoundariesError`.
- **getItemStack(amount?: number, withData?: boolean): ItemStack | undefined** - Creates item stack from block. Throws `LocationInUnloadedChunkError`, `LocationOutOfWorldBoundariesError`.
- **getRedstonePower(): number | undefined** - Returns redstone power. Throws `LocationInUnloadedChunkError`, `LocationOutOfWorldBoundariesError`.
- **getTags(): string[]** - Returns block tags. Throws `LocationInUnloadedChunkError`, `LocationOutOfWorldBoundariesError`.
- **hasTag(tag: string): boolean** - Checks for specific tag. Throws `LocationInUnloadedChunkError`, `LocationOutOfWorldBoundariesError`.
- **isLiquidBlocking(liquidType: LiquidType): boolean** - Checks if block stops liquid flow. Throws `Error`, `LocationInUnloadedChunkError`, `LocationOutOfWorldBoundariesError`.
- **liquidCanFlowFromDirection(liquidType: LiquidType, flowDirection: Direction): boolean** - Checks liquid flow in/out. Throws `Error`, `LocationInUnloadedChunkError`, `LocationOutOfWorldBoundariesError`.
- **liquidSpreadCausesSpawn(liquidType: LiquidType): boolean** - Checks if liquid causes item spawn. Throws `Error`, `LocationInUnloadedChunkError`, `LocationOutOfWorldBoundariesError`.
- **matches(blockName: string, states?: Record<string, boolean | number | string>): boolean** - Tests block criteria. Throws `LocationInUnloadedChunkError`, `LocationOutOfWorldBoundariesError`.
- **north(steps?: number): Block | undefined** - Returns block to north (Z-). Throws `LocationInUnloadedChunkError`, `LocationOutOfWorldBoundariesError`.
- **offset(offset: Vector3): Block | undefined** - Returns block at offset. Throws `LocationInUnloadedChunkError`, `LocationOutOfWorldBoundariesError`.
- **setPermutation(permutation: BlockPermutation): void** - Sets block state. Not allowed in read-only mode. Throws `LocationInUnloadedChunkError`, `LocationOutOfWorldBoundariesError`.
- **setType(blockType: BlockType | string): void** - Sets block type. Not allowed in read-only mode. Throws `Error`, `LocationInUnloadedChunkError`, `LocationOutOfWorldBoundariesError`.
- **setWaterlogged(isWaterlogged: boolean): void** - Sets waterlogged state. Not allowed in read-only mode. Throws `Error`, `LocationInUnloadedChunkError`, `LocationOutOfWorldBoundariesError`.
- **south(steps?: number): Block | undefined** - Returns block to south (Z+). Throws `LocationInUnloadedChunkError`, `LocationOutOfWorldBoundariesError`.
- **west(steps?: number): Block | undefined** - Returns block to west (X-). Throws `LocationInUnloadedChunkError`, `LocationOutOfWorldBoundariesError`.

### Example
```typescript
import { DimensionLocation } from "@minecraft/server";

function checkBlockTags(log: (message: string, status?: number) => void, targetLocation: DimensionLocation) {
  const block = targetLocation.dimension.getBlock(targetLocation);
  if (block) {
    log(`Block is dirt: ${block.hasTag("dirt")}`);
    log(`Block is wood: ${block.hasTag("wood")}`);
    log(`Block is stone: ${block.hasTag("stone")}`);
  }
}
```

## BlockPermutation Class
- **Date**: 04/09/2025
- **Description**: Contains the combination of type `@minecraft/server.BlockType` and properties (block state) describing a block, but not tied to a specific `@minecraft/server.Block`.

### Properties
- **type**: `read-only BlockType` - The `@minecraft/server.BlockType` of the permutation.

### Methods
- **canBeDestroyedByLiquidSpread(liquidType: LiquidType): boolean** - Checks if block is removed by liquid. Throws errors.
- **canContainLiquid(liquidType: LiquidType): boolean** - Checks if block can be waterlogged. Throws errors.
- **getAllStates(): Record<string, boolean | number | string>** - Returns all block states of the permutation.
- **getItemStack(amount?: number): ItemStack | undefined** - Creates prototype item stack for Container APIs. Default amount: 1.
- **getState(stateName: T): minecraftvanilladata.BlockStateSuperset[T] | undefined** - Gets specific block state value or undefined.
- **getTags(): string[]** - Returns permutation tags.
- **hasTag(tag: string): boolean** - Checks for specific tag.
- **isLiquidBlocking(liquidType: LiquidType): boolean** - Checks if block stops liquid flow. Throws errors.
- **liquidSpreadCausesSpawn(liquidType: LiquidType): boolean** - Checks if liquid causes item spawn. Throws errors.
- **matches(blockName: T, states?: BlockStateArg<T>): boolean** - Checks if permutation matches criteria.
- **withState(name: T, value: minecraftvanilladata.BlockStateSuperset[T]): BlockPermutation** - Returns permutation with updated property. Throws errors.
- **resolve(blockName: T, states?: BlockStateArg<T>): BlockPermutation** - Creates BlockPermutation for block APIs. Throws errors.

### Examples
```typescript
import { BlockPermutation, DimensionLocation } from "@minecraft/server";
import { Vector3Utils } from "@minecraft/math";
import { MinecraftBlockTypes } from "@minecraft/vanilla-data";

function addBlockColorCube(targetLocation: DimensionLocation) {
  const allWoolBlocks: string[] = [
    MinecraftBlockTypes.WhiteWool,
    MinecraftBlockTypes.OrangeWool,
    MinecraftBlockTypes.MagentaWool,
    MinecraftBlockTypes.LightBlueWool,
    MinecraftBlockTypes.YellowWool,
    MinecraftBlockTypes.LimeWool,
    MinecraftBlockTypes.PinkWool,
    MinecraftBlockTypes.GrayWool,
    MinecraftBlockTypes.LightGrayWool,
    MinecraftBlockTypes.CyanWool,
    MinecraftBlockTypes.PurpleWool,
    MinecraftBlockTypes.BlueWool,
    MinecraftBlockTypes.BrownWool,
    MinecraftBlockTypes.GreenWool,
    MinecraftBlockTypes.RedWool,
    MinecraftBlockTypes.BlackWool,
  ];
  const cubeDim = 7;
  let colorIndex = 0;
  for (let x = 0; x <= cubeDim; x++) {
    for (let y = 0; y <= cubeDim; y++) {
      for (let z = 0; z <= cubeDim; z++) {
        colorIndex++;
        targetLocation.dimension
          .getBlock(Vector3Utils.add(targetLocation, { x, y, z }))
          ?.setPermutation(BlockPermutation.resolve(allWoolBlocks[colorIndex % allWoolBlocks.length]));
      }
    }
  }
}
```
```typescript
import { world, BlockPermutation, BlockSignComponent, BlockComponentTypes, DimensionLocation } from "@minecraft/server";
import { MinecraftBlockTypes } from "@minecraft/vanilla-data";

function addTranslatedSign(log: (message: string, status?: number) => void, targetLocation: DimensionLocation) {
  const players = world.getPlayers();
  const dim = players[0].dimension;
  const signBlock = dim.getBlock(targetLocation);
  if (!signBlock) {
    log("Could not find a block at specified location.");
    return -1;
  }
  const signPerm = BlockPermutation.resolve(MinecraftBlockTypes.StandingSign, { ground_sign_direction: 8 });
  signBlock.setPermutation(signPerm);
  const signComponent = signBlock.getComponent(BlockComponentTypes.Sign) as BlockSignComponent;
  signComponent?.setText({ translate: "item.skull.player.name", with: [players[0].name] });
}
```

## BlockStates Class
- **Date**: 02/10/2025
- **Description**: Enumerates all `@minecraft/server.BlockStateTypes`.

### Methods
- **get(stateName: string): BlockStateType | undefined** - Retrieves specific block state.
- **getAll(): BlockStateType[]** - Retrieves all block states.

## Dimension Class
- **Date**: 07/02/2025
- **Description**: Represents a dimension (e.g., The End).

### Properties
- **heightRange**: `read-only minecraftcommon.NumberRange` - Dimension height range. Throws errors.
- **id**: `read-only string` - Dimension identifier.
- **localizationKey**: `read-only string` - Localization key for dimension name.

### Methods
- **containsBlock(volume: BlockVolumeBase, filter: BlockFilter, allowUnloadedChunks?: boolean): boolean** - Checks if volume contains block matching filter. Throws `Error`, `UnloadedChunksError`.
- **createExplosion(location: Vector3, radius: number, explosionOptions?: ExplosionOptions): boolean** - Creates explosion. Not allowed in read-only mode. Throws `LocationInUnloadedChunkError`, `LocationOutOfWorldBoundariesError`.
- **fillBlocks(volume: BlockVolumeBase | CompoundBlockVolume, block: BlockPermutation | BlockType | string, options?: BlockFillOptions): ListBlockVolume** - Fills area with block type. Not allowed in read-only mode. Throws `EngineError`, `Error`, `UnloadedChunksError`.
- **getBlock(location: Vector3): Block | undefined** - Returns block at location. Throws `LocationInUnloadedChunkError`, `LocationOutOfWorldBoundariesError`.
- **getBlockAbove(location: Vector3, options?: BlockRaycastOptions): Block | undefined** - Gets block above. Not allowed in read-only mode. Throws errors.
- **getBlockBelow(location: Vector3, options?: BlockRaycastOptions): Block | undefined** - Gets block below. Not allowed in read-only mode. Throws errors.
- **getBlockFromRay(location: Vector3, direction: Vector3, options?: BlockRaycastOptions): BlockRaycastHit | undefined** - Gets first block in ray. Throws errors.
- **getBlocks(volume: BlockVolumeBase, filter: BlockFilter, allowUnloadedChunks?: boolean): ListBlockVolume** - Gets blocks matching filter. Throws `Error`, `UnloadedChunksError`.
- **getEntities(options?: EntityQueryOptions): Entity[]** - Returns entities based on filter. Throws `CommandError`, `InvalidArgumentError`.
- **getEntitiesAtBlockLocation(location: Vector3): Entity[]** - Returns entities at location.
- **getEntitiesFromRay(location: Vector3, direction: Vector3, options?: EntityRaycastOptions): EntityRaycastHit[]** - Gets entities in ray. Throws `EngineError`, `InvalidArgumentError`, `InvalidEntityError`, `UnsupportedFunctionalityError`.
- **getPlayers(options?: EntityQueryOptions): Player[]** - Returns players based on filter. Throws `CommandError`, `InvalidArgumentError`.
- **getTopmostBlock(locationXZ: VectorXZ, minHeight?: number): Block | undefined** - Returns highest block at XZ. Not allowed in read-only mode. Throws errors.
- **placeFeature(featureName: string, location: Vector3, shouldThrow?: boolean): boolean** - Places feature. Not allowed in read-only mode. Throws `Error`, `InvalidArgumentError`, `LocationInUnloadedChunkError`.
- **placeFeatureRule(featureRuleName: string, location: Vector3): boolean** - Places feature rule. Not allowed in read-only mode. Throws `InvalidArgumentError`, `LocationInUnloadedChunkError`.
- **playSound(soundId: string, location: Vector3, soundOptions?: WorldSoundOptions): void** - Plays sound for all players. Not allowed in read-only mode. Throws `PropertyOutOfBoundsError`.
- **runCommand(commandString: string): CommandResult** - Runs command synchronously. Not allowed in read-only mode. Throws `CommandError`.
- **setBlockPermutation(location: Vector3, permutation: BlockPermutation): void** - Sets block permutation. Not allowed in read-only mode. Throws `LocationInUnloadedChunkError`, `LocationOutOfWorldBoundariesError`.
- **setBlockType(location: Vector3, blockType: BlockType | string): void** - Sets block type. Not allowed in read-only mode. Throws `Error`, `LocationInUnloadedChunkError`, `LocationOutOfWorldBoundariesError`.
- **setWeather(weatherType: WeatherType, duration?: number): void** - Sets weather. Not allowed in read-only mode. Throws errors.
- **spawnEntity(identifier: EntityIdentifierType<NoInfer<T>>, location: Vector3, options?: SpawnEntityOptions): Entity** - Spawns entity. Not allowed in read-only mode. Throws `EntitySpawnError`, `InvalidArgumentError`, `InvalidEntityError`, `LocationInUnloadedChunkError`, `LocationOutOfWorldBoundariesError`.
- **spawnItem(itemStack: ItemStack, location: Vector3): Entity** - Spawns item stack as entity. Not allowed in read-only mode. Throws `LocationInUnloadedChunkError`, `LocationOutOfWorldBoundariesError`.
- **spawnParticle(effectName: string, location: Vector3, molangVariables?: MolangVariableMap): void** - Spawns particle. Not allowed in read-only mode. Throws `LocationInUnloadedChunkError`, `LocationOutOfWorldBoundariesError`.

### Examples
```typescript
import { DimensionLocation } from "@minecraft/server";

function createExplosion(log: (message: string, status?: number) => void, targetLocation: DimensionLocation) {
  log("Creating an explosion of radius 10.");
  targetLocation.dimension.createExplosion(targetLocation, 10);
}
```

## Effect Class
- **Date**: 06/11/2025
- **Description**: Represents an effect (e.g., poison) on an entity.

### Properties
- **amplifier**: `read-only number` - Effect amplifier (0-4). Throws errors.
- **displayName**: `read-only string` - Player-friendly effect name. Throws errors.
- **duration**: `read-only number` - Effect duration in ticks (20 ticks/second). Throws errors.
- **isValid**: `read-only boolean` - True if effect is valid.
- **typeId**: `read-only string` - Effect type identifier. Throws errors.

## Entity Class
- **Date**: 07/02/2025
- **Description**: Represents entities (mobs, players, etc.) in the world.
- **Extends**: Player

### Properties
- **dimension**: `read-only Dimension` - Entity's dimension. Throws `EngineError`, `InvalidEntityError`.
- **id**: `read-only string` - Unique entity identifier.
- **isClimbing**: `read-only boolean` - True if touching climbable block. Throws `InvalidEntityError`.
- **isFalling**: `read-only boolean` - True if falling. Throws `InvalidEntityError`.
- **isInWater**: `read-only boolean` - True if in water. Throws `InvalidEntityError`.
- **isOnGround**: `read-only boolean` - True if on solid block. Throws `InvalidEntityError`.
- **isSleeping**: `read-only boolean` - True if sleeping. Throws `InvalidEntityError`.
- **isSneaking**: `boolean` - True if sneaking. Not editable in read-only mode.
- **isSprinting**: `read-only boolean` - True if sprinting. Throws `InvalidEntityError`.
- **isSwimming**: `read-only boolean` - True if swimming. Throws `InvalidEntityError`.
- **isValid**: `read-only boolean` - True if entity is manipulable.
- **localizationKey**: `read-only string` - Localization key for entity name. Throws `InvalidEntityError`.
- **location**: `read-only Vector3` - Entity location. Throws `InvalidEntityError`.
- **nameTag**: `string` - Entity name. Not editable in read-only mode.
- **scoreboardIdentity**: `read-only ScoreboardIdentity` - Scoreboard identity.
- **typeId**: `read-only string` - Entity type identifier.

### Methods
- **addEffect(effectType: EffectType | string, duration: number, options?: EntityEffectOptions): Effect | undefined** - Adds effect. Not allowed in read-only mode. Throws `ArgumentOutOfBoundsError`, `InvalidArgumentError`, `InvalidEntityError`.
- **addTag(tag: string): boolean** - Adds tag. Not allowed in read-only mode. Throws `ArgumentOutOfBoundsError`, `InvalidEntityError`.
- **applyDamage(amount: number, options?: EntityApplyDamageByProjectileOptions | EntityApplyDamageOptions): boolean** - Applies damage. Not allowed in read-only mode. Throws `EngineError`, `InvalidEntityError`, `UnsupportedFunctionalityError`.
- **applyImpulse(vector: Vector3): void** - Applies impulse. Not allowed in read-only mode. Throws `ArgumentOutOfBoundsError`, `InvalidEntityError`.
- **applyKnockback(horizontalForce: VectorXZ, verticalStrength: number): void** - Applies knockback. Not allowed in read-only mode. Throws `InvalidEntityError`, `UnsupportedFunctionalityError`.
- **clearDynamicProperties(): void** - Clears dynamic properties. Throws `InvalidEntityError`.
- **clearVelocity(): void** - Sets velocity to zero. Not allowed in read-only mode. Throws `InvalidEntityError`.
- **extinguishFire(useEffects?: boolean): boolean** - Extinguishes fire. Not allowed in read-only mode. Throws `InvalidEntityError`.
- **getBlockFromViewDirection(options?: BlockRaycastOptions): BlockRaycastHit | undefined** - Gets block in view direction. Throws `InvalidEntityError`.
- **getComponent(componentId: T): EntityComponentReturnType<T> | undefined** - Gets component. Throws `InvalidEntityError`.
- **getComponents(): EntityComponent[]** - Gets all components. Throws `InvalidEntityError`.
- **getDynamicProperty(identifier: string): boolean | number | string | Vector3 | undefined** - Gets dynamic property. Throws `InvalidEntityError`.
- **getDynamicPropertyIds(): string[]** - Gets dynamic property IDs. Throws `InvalidEntityError`.
- **getDynamicPropertyTotalByteCount(): number** - Gets dynamic property size. Throws `InvalidEntityError`.
- **getEffect(effectType: EffectType | string): Effect | undefined** - Gets effect. Throws `InvalidArgumentError`, `InvalidEntityError`.
- **getEffects(): Effect[]** - Gets all effects. Throws `InvalidEntityError`.
- **getEntitiesFromViewDirection(options?: EntityRaycastOptions): EntityRaycastHit[]** - Gets entities in view direction. Throws `EngineError`, `InvalidArgumentError`, `InvalidEntityError`, `UnsupportedFunctionalityError`.
- **getHeadLocation(): Vector3** - Gets head location. Throws `InvalidEntityError`.
- **getProperty(identifier: string): boolean | number | string | undefined** - Gets property. Throws `InvalidEntityError`.
- **getRotation(): Vector2** - Gets rotation. Throws `InvalidEntityError`.
- **getTags(): string[]** - Gets tags. Throws `InvalidEntityError`.
- **getVelocity(): Vector3** - Gets velocity. Throws `InvalidEntityError`.
- **getViewDirection(): Vector3** - Gets view direction. Throws `InvalidEntityError`.
- **hasComponent(componentId: string): boolean** - Checks for component. Throws `InvalidEntityError`.
- **hasTag(tag: string): boolean** - Checks for tag. Throws `InvalidEntityError`.
- **kill(): boolean** - Kills entity. Not allowed in read-only mode. Throws `InvalidEntityError`.
- **lookAt(targetLocation: Vector3): void** - Sets rotation to face location. Not allowed in read-only mode. Throws `InvalidEntityError`, `UnsupportedFunctionalityError`.
- **matches(options: EntityQueryOptions): boolean** - Matches entity against options. Throws `InvalidArgumentError`, `InvalidEntityError`, `UnsupportedFunctionalityError`.
- **playAnimation(animationName: string, options?: PlayAnimationOptions): void** - Plays animation. Not allowed in read-only mode. Throws `InvalidEntityError`.
- **remove(): void** - Removes entity. Not allowed in read-only mode. Throws `InvalidEntityError`, `UnsupportedFunctionalityError`.
- **removeEffect(effectType: EffectType | string): boolean** - Removes effect. Not allowed in read-only mode. Throws `InvalidArgumentError`, `InvalidEntityError`.
- **removeTag(tag: string): boolean** - Removes tag. Not allowed in read-only mode. Throws `InvalidEntityError`.
- **resetProperty(identifier: string): boolean | number | string** - Resets property. Not allowed in read-only mode. Throws `EngineError`, `Error`, `InvalidEntityError`.
- **runCommand(commandString: string): CommandResult** - Runs command. Not allowed in read-only mode. Throws `CommandError`, `InvalidEntityError`.
- **setDynamicProperty(identifier: string, value?: boolean | number | string | Vector3): void** - Sets dynamic property. Throws `ArgumentOutOfBoundsError`, `InvalidEntityError`.
- **setOnFire(seconds: number, useEffects?: boolean): boolean** - Sets entity on fire. Not allowed in read-only mode. Throws `InvalidEntityError`.
- **setProperty(identifier: string, value: boolean | number | string): void** - Sets property. Not allowed in read-only mode. Throws `ArgumentOutOfBoundsError`, `InvalidArgumentError`, `InvalidEntityError`.
- **setRotation(rotation: Vector2): void** - Sets rotation. Not allowed in read-only mode. Throws `InvalidEntityError`.
- **teleport(location: Vector3, teleportOptions?: TeleportOptions): void** - Teleports entity. Not allowed in read-only mode. Throws `InvalidEntityError`, `UnsupportedFunctionalityError`.
- **triggerEvent(eventName: string): void** - Triggers event. Not allowed in read-only mode. Throws `InvalidArgumentError`, `InvalidEntityError`.
- **tryTeleport(location: Vector3, teleportOptions?: TeleportOptions): boolean** - Attempts teleport. Not allowed in read-only mode. Throws `InvalidEntityError`, `UnsupportedFunctionalityError`.

### Example
```typescript
import { DimensionLocation } from "@minecraft/server";
import { MinecraftEntityTypes } from "@minecraft/vanilla-data";

function triggerEvent(targetLocation: DimensionLocation) {
  const creeper = targetLocation.dimension.spawnEntity(MinecraftEntityTypes.Creeper, targetLocation);
  creeper.triggerEvent("minecraft:start_exploding_forced");
}
```

## EntityAddRiderComponent Class
- **Date**: 02/10/2025
- **Description**: Makes entity spawn with a rider.
- **Extends**: EntityComponent

### Properties
- **entityType**: `read-only string` - Rider entity type. Throws errors.
- **spawnEvent**: `read-only string` - Spawn event for rider. Throws errors.
- **componentId**: `static read-only string` - `"minecraft:addrider"`.

## ItemStack Class
- **Date**: 07/02/2025
- **Description**: Defines a collection of items.

### Properties
- **amount**: `number` - Item count (1-255). Not editable in read-only mode. Throws errors if out of range.
- **isStackable**: `read-only boolean` - True if max stack size > 1 and no custom data.
- **keepOnDeath**: `boolean` - True if kept on death. Not editable in read-only mode.
- **localizationKey**: `read-only string` - Localization key for item name. Throws `EngineError`.
- **lockMode**: `ItemLockMode` - Item lock mode. Not editable in read-only mode.
- **maxAmount**: `read-only number` - Maximum stack size.
- **nameTag**: `string | undefined` - Item name tag. Not editable in read-only mode. Throws if > 255 characters.
- **type**: `read-only ItemType` - Item type.
- **typeId**: `read-only string` - Item type identifier.

### Methods
- **constructor(itemType: ItemType | string, amount?: number): ItemStack** - Creates item stack. Throws if `itemType` invalid or `amount` out of range.
- **clearDynamicProperties(): void** - Clears dynamic properties.
- **clone(): ItemStack** - Creates copy of item stack.
- **getCanDestroy(): string[]** - Gets block types item can break. Not allowed in read-only mode.
- **getCanPlaceOn(): string[]** - Gets block types item can be placed on. Not allowed in read-only mode.
- **getComponent(componentId: T): ItemComponentReturnType<T> | undefined** - Gets component.
- **getComponents(): ItemComponent[]** - Gets all components.
- **getDynamicProperty(identifier: string): boolean | number | string | Vector3 | undefined** - Gets dynamic property.
- **getDynamicPropertyIds(): string[]** - Gets dynamic property IDs.
- **getDynamicPropertyTotalByteCount(): number** - Gets dynamic property size.
- **getLore(): string[]** - Gets lore.
- **getTags(): string[]** - Gets tags.
- **hasComponent(componentId: string): boolean** - Checks for component.
- **hasTag(tag: string): boolean** - Checks for tag.
- **isStackableWith(itemStack: ItemStack): boolean** - Checks stacking compatibility.
- **matches(itemName: string, states?: Record<string, boolean | number | string>): boolean** - Checks if item matches.
- **setCanDestroy(blockIdentifiers?: string[]): void** - Sets block types item can break. Not allowed in read-only mode. Throws if identifiers invalid.
- **setCanPlaceOn(blockIdentifiers?: string[]): void** - Sets block types item can be placed on. Not allowed in read-only mode. Throws if identifiers invalid.
- **setDynamicProperty(identifier: string, value?: boolean | number | string | Vector3): void** - Sets dynamic property. Throws `ArgumentOutOfBoundsError`, `UnsupportedFunctionalityError`.
- **setLore(loreList?: (RawMessage | string)[]): void** - Sets lore. Not allowed in read-only mode. Throws `ArgumentOutOfBoundsError`, `Error`.

### Example
```typescript
import { ItemStack, DimensionLocation } from "@minecraft/server";
import { MinecraftItemTypes } from "@minecraft/vanilla-data";

function itemStacks(log: (message: string, status?: number) => void, targetLocation: DimensionLocation) {
  const oneEmerald = new ItemStack(MinecraftItemTypes.Emerald, 1);
  const fiveEmeralds = new ItemStack(MinecraftItemTypes.Emerald, 5);
  const onePickaxe = new ItemStack(MinecraftItemTypes.DiamondPickaxe, 1);
  log(`Spawning an emerald at (${oneItemLoc.x}, ${oneItemLoc.y}, ${oneItemLoc.z})`);
  targetLocation.dimension.spawnItem(oneEmerald, oneItemLoc);
}
```

## ItemUseOnEvent Class
- **Date**: 02/10/2025
- **Description**: Information about item use on a block.
- **Extends**: ItemComponentUseOnEvent

### Properties
- **block**: `read-only Block` - Impacted block.
- **blockFace**: `read-only Direction` - Face of block used on.
- **faceLocation**: `read-only Vector3` - Location relative to block's bottom north-west corner.
- **itemStack**: `read-only ItemStack` - Used item stack.
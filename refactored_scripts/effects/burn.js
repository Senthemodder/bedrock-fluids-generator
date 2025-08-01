// effects/burn.js
export function apply(entity, fluidData) {
    if (fluidData.burnTime > 0 && entity.getComponent("health")) {
        entity.setOnFire(fluidData.burnTime, true);
    }
}

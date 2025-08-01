// effects/damage.js
export function apply(entity, fluidData) {
    if (fluidData.damage > 0 && entity.getComponent("health")) {
        entity.applyDamage(fluidData.damage);
    }
}

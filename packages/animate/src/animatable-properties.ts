import type { AnimatableProperties } from "./types.js";

/**
 * The neutral value each animatable property falls back to when it is absent
 * from a keyframe. Scale-family properties and opacity rest at `1`; every
 * translation, rotation, and skew rests at `0`.
 */
export const propertyDefaults: { [K in keyof Required<AnimatableProperties>]: number } = {
    opacity: 1,
    translateX: 0,
    translateY: 0,
    scale: 1,
    scaleX: 1,
    scaleY: 1,
    rotate: 0,
    skewX: 0,
    skewY: 0,
};

/**
 * Resolve the resting value of a single animatable property from the shared
 * {@link propertyDefaults} table.
 *
 * @param property - The animatable property to resolve a default for.
 * @returns The neutral value the property animates from or to when unset.
 */
export const getDefaultValue = (property: keyof AnimatableProperties): number => propertyDefaults[property];

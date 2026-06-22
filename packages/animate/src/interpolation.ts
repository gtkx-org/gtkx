import { propertyDefaults } from "./animatable-properties.js";
import type { AnimatableProperties } from "./types.js";

export const interpolate = (
    from: AnimatableProperties,
    to: AnimatableProperties,
    progress: number,
): AnimatableProperties => {
    const result: AnimatableProperties = {};
    const allKeys = new Set([...Object.keys(from), ...Object.keys(to)]) as Set<keyof AnimatableProperties>;

    for (const key of allKeys) {
        const fromVal = from[key] ?? propertyDefaults[key];
        const toVal = to[key] ?? propertyDefaults[key];
        result[key] = fromVal + (toVal - fromVal) * progress;
    }

    return result;
};

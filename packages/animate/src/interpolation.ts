import type { AnimatableProperties } from "./types.js";

const propertyDefaults: { [K in keyof Required<AnimatableProperties>]: number } = {
    opacity: 1,
    x: 0,
    y: 0,
    scale: 1,
    scaleX: 1,
    scaleY: 1,
    rotate: 0,
    skewX: 0,
    skewY: 0,
};

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

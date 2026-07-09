import type { AnimationTarget } from "./animation-types.js";

const propertyDefaults: { [K in keyof Required<AnimationTarget>]: number } = {
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

export const interpolate = (from: AnimationTarget, to: AnimationTarget, progress: number): AnimationTarget => {
    const result: AnimationTarget = {};
    const allKeys = new Set([...Object.keys(from), ...Object.keys(to)]) as Set<keyof AnimationTarget>;

    for (const key of allKeys) {
        const fromVal = from[key] ?? propertyDefaults[key];
        const toVal = to[key] ?? propertyDefaults[key];
        result[key] = fromVal + (toVal - fromVal) * progress;
    }

    return result;
};

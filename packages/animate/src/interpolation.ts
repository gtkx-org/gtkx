import { propertyDefaults } from "./animatable-properties.js";
import type { AnimatableProperties } from "./types.js";

/**
 * Linearly interpolate every animatable property between two keyframes.
 *
 * Each property present in either keyframe is interpolated independently;
 * missing properties fall back to their neutral resting value via
 * {@link propertyDefaults}.
 *
 * @param from - The starting keyframe.
 * @param to - The ending keyframe.
 * @param progress - The interpolation position in the `[0, 1]` range.
 * @returns A keyframe holding the interpolated value of every involved property.
 */
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

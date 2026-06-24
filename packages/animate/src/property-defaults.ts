import type { AnimatableProperties } from "./types.js";

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

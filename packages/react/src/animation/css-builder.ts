import type { AnimatableProperties } from "./types.js";

const getDefaultValue = (property: keyof AnimatableProperties): number => {
    switch (property) {
        case "opacity":
        case "scale":
        case "scaleX":
        case "scaleY":
            return 1;
        default:
            return 0;
    }
};

export const interpolate = (
    from: AnimatableProperties,
    to: AnimatableProperties,
    progress: number,
): AnimatableProperties => {
    const result: AnimatableProperties = {};

    const allKeys = new Set([...Object.keys(from), ...Object.keys(to)]) as Set<keyof AnimatableProperties>;

    for (const key of allKeys) {
        const fromVal = from[key] ?? getDefaultValue(key);
        const toVal = to[key] ?? getDefaultValue(key);
        result[key] = fromVal + (toVal - fromVal) * progress;
    }

    return result;
};

export const buildCss = (className: string, props: AnimatableProperties): string => {
    const parts: string[] = [];
    const transforms: string[] = [];

    if (props.opacity !== undefined) {
        parts.push(`opacity: ${props.opacity}`);
    }

    if (props.translateX !== undefined || props.translateY !== undefined) {
        transforms.push(`translate(${props.translateX ?? 0}px, ${props.translateY ?? 0}px)`);
    }

    if (props.scale !== undefined) {
        transforms.push(`scale(${props.scale})`);
    } else if (props.scaleX !== undefined || props.scaleY !== undefined) {
        transforms.push(`scale(${props.scaleX ?? 1}, ${props.scaleY ?? 1})`);
    }

    if (props.rotate !== undefined) {
        transforms.push(`rotate(${props.rotate}deg)`);
    }

    if (props.skewX !== undefined) {
        transforms.push(`skewX(${props.skewX}deg)`);
    }

    if (props.skewY !== undefined) {
        transforms.push(`skewY(${props.skewY}deg)`);
    }

    if (transforms.length > 0) {
        parts.push(`transform: ${transforms.join(" ")}`);
    }

    if (parts.length === 0) {
        return "";
    }

    return `.${className} { ${parts.join("; ")}; }`;
};

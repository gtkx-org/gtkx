import type { AnimationTarget } from "./types.js";

type CssTarget = "style" | "transform";

type PropertySerializer = {
    target: CssTarget;
    serialize: (props: AnimationTarget) => string | undefined;
};

const propertySerializers: PropertySerializer[] = [
    {
        target: "style",
        serialize: ({ opacity }) => (opacity !== undefined ? `opacity: ${opacity}` : undefined),
    },
    {
        target: "transform",
        serialize: ({ x, y }) =>
            x !== undefined || y !== undefined ? `translate(${x ?? 0}px, ${y ?? 0}px)` : undefined,
    },
    {
        target: "transform",
        serialize: ({ scale, scaleX, scaleY }) => {
            if (scale !== undefined) {
                return `scale(${scale})`;
            }
            if (scaleX !== undefined || scaleY !== undefined) {
                return `scale(${scaleX ?? 1}, ${scaleY ?? 1})`;
            }
            return undefined;
        },
    },
    {
        target: "transform",
        serialize: ({ rotate }) => (rotate !== undefined ? `rotate(${rotate}deg)` : undefined),
    },
    {
        target: "transform",
        serialize: ({ skewX }) => (skewX !== undefined ? `skewX(${skewX}deg)` : undefined),
    },
    {
        target: "transform",
        serialize: ({ skewY }) => (skewY !== undefined ? `skewY(${skewY}deg)` : undefined),
    },
];

export const buildCss = (className: string, props: AnimationTarget): string => {
    const parts: string[] = [];
    const transforms: string[] = [];

    for (const { target, serialize } of propertySerializers) {
        const fragment = serialize(props);
        if (fragment === undefined) continue;
        if (target === "transform") {
            transforms.push(fragment);
        } else {
            parts.push(fragment);
        }
    }

    if (transforms.length > 0) {
        parts.push(`transform: ${transforms.join(" ")}`);
    }

    if (parts.length === 0) {
        return "";
    }

    return `.${className} { ${parts.join("; ")}; }`;
};

import type { AnimatableProperties } from "./types.js";

type CssTarget = "style" | "transform";

type PropertySerializer = {
    target: CssTarget;
    serialize: (props: AnimatableProperties) => string | undefined;
};

/**
 * The ordered set of serializers that turn animatable properties into GTK CSS
 * fragments. Entries declare whether they contribute a top-level style
 * declaration (`style`) or a `transform`-function fragment (`transform`), and
 * the iteration order fixes the order in which fragments appear in the output.
 *
 * Transform-family properties are grouped here so coupled axes serialize
 * together: `translateX`/`translateY` coalesce into a single `translate(...)`
 * and `scale` shadows the two-axis `scale(scaleX, scaleY)` form.
 */
const propertySerializers: PropertySerializer[] = [
    {
        target: "style",
        serialize: ({ opacity }) => (opacity !== undefined ? `opacity: ${opacity}` : undefined),
    },
    {
        target: "transform",
        serialize: ({ translateX, translateY }) =>
            translateX !== undefined || translateY !== undefined
                ? `translate(${translateX ?? 0}px, ${translateY ?? 0}px)`
                : undefined,
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

/**
 * Build a GTK CSS rule for a class from a keyframe of animatable properties.
 *
 * Style declarations and `transform` fragments are emitted in the declared
 * {@link propertySerializers} order; when no property is set the result is the
 * empty string so callers can skip writing an empty rule.
 *
 * @param className - The CSS class the rule targets.
 * @param props - The keyframe whose properties become CSS declarations.
 * @returns The CSS rule text, or the empty string when nothing is set.
 */
export const buildCss = (className: string, props: AnimatableProperties): string => {
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

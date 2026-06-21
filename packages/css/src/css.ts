import type { CSSInterpolation } from "@emotion/serialize";
import { classNameFor, insert, registeredStylesFor, serialize } from "./registry.js";

/**
 * Serializes the given style interpolations and inserts them as a scoped GTK CSS rule,
 * returning the generated class name. Identical styles return the same class name and
 * are inserted only once.
 */
export const css = (...args: CSSInterpolation[]): string => {
    const serialized = serialize(args);
    insert(serialized, { scoped: true });
    return classNameFor(serialized);
};

type CxToken = string | boolean | undefined | null;

/**
 * Combines class names for GTK's `cssClasses` array prop, dropping falsy entries.
 *
 * When two or more arguments are class names produced by {@link css}, their registered
 * styles are merged and re-serialized into a single override class so that later styles
 * win over earlier ones for any conflicting property. Raw class names and a lone
 * registered class are passed through unchanged.
 */
export const cx = (...classNames: CxToken[]): string[] => {
    const tokens = classNames.filter((cn): cn is string => typeof cn === "string" && cn.length > 0);

    const rawClasses: string[] = [];
    const registeredStyles: string[] = [];
    for (const token of tokens) {
        const styles = registeredStylesFor(token);
        if (styles === undefined) {
            rawClasses.push(token);
        } else {
            registeredStyles.push(styles);
        }
    }

    if (registeredStyles.length < 2) return tokens;

    return [...rawClasses, css(registeredStyles.join(""))];
};

/**
 * Serializes the given style interpolations and inserts them as unscoped, global GTK CSS.
 * Identical styles are inserted only once.
 */
export const injectGlobal = (...args: CSSInterpolation[]): void => {
    insert(serialize(args), { scoped: false });
};

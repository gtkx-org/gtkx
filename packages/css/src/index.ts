import type { CSSInterpolation } from "@emotion/serialize";
import { createInstance } from "./create-instance.js";

export { createInstance, type Instance, type InstanceOptions } from "./create-instance.js";
export { type DisplayProvider, registerProviderForDefaultDisplay } from "./provider.js";

type CxToken = string | boolean | undefined | null;

const instance = createInstance({ key: "gtkx" });

/**
 * Serializes the given style interpolations and inserts them as a scoped GTK CSS rule,
 * returning the generated class name. Identical styles return the same class name and
 * are inserted only once.
 */
export const css: (...args: CSSInterpolation[]) => string = instance.css;

/**
 * Combines class names for GTK's `cssClasses` array prop, dropping falsy entries.
 *
 * When two or more arguments are class names produced by {@link css}, their registered
 * styles are merged and re-serialized into a single override class so that later styles
 * win over earlier ones for any conflicting property. Raw class names and a lone
 * registered class are passed through unchanged.
 */
export const cx: (...classNames: CxToken[]) => string[] = instance.cx;

/**
 * Serializes the given style interpolations and inserts them as unscoped, global GTK CSS.
 * Identical styles are inserted only once.
 */
export const injectGlobal: (...args: CSSInterpolation[]) => void = instance.injectGlobal;

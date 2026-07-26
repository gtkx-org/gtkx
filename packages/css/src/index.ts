import { createCss, type Css } from "./create-css.js";

const instance = createCss();
/**
 * Serializes the given style interpolations, inserts the resulting rules into
 * the default stylesheet, and returns the generated GTK4 CSS class name.
 */
const css: Css["css"] = instance.css;
/**
 * Combines class name tokens, filtering out falsy values and merging any
 * gtkx-registered styles into a single generated class.
 */
const cx: Css["cx"] = instance.cx;
/**
 * Serializes and inserts the given styles into the default stylesheet globally,
 * without scoping them to a generated class.
 */
const injectGlobal: Css["injectGlobal"] = instance.injectGlobal;

export { css, cx, injectGlobal };

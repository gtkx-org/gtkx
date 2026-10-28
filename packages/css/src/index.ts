import type { Css } from "./create-css.js";
import { instance } from "./instance.js";

/** Serializes and inserts GTK4 styles, returning their generated class. */
const css: Css["css"] = instance.css;
/** Combines class names and merges generated styles. */
const cx: Css["cx"] = instance.cx;
/** Inserts unscoped GTK4 styles. */
const injectGlobal: Css["injectGlobal"] = instance.injectGlobal;

export { css, cx, injectGlobal };

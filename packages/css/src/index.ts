import { type Css, createCss } from "./create-css.js";

export { registerProviderForDefaultDisplay } from "./provider.js";

const instance = createCss();

export const css: Css["css"] = instance.css;
export const cx: Css["cx"] = instance.cx;
export const injectGlobal: Css["injectGlobal"] = instance.injectGlobal;

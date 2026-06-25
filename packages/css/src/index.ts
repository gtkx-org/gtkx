import type { CSSInterpolation } from "@emotion/serialize";
import { createInstance } from "./create-instance.js";

export { type Css, type CssOptions, createInstance } from "./create-instance.js";
export { registerProviderForDefaultDisplay } from "./provider.js";

type CxToken = string | boolean | undefined | null;

const instance = createInstance({ key: "gtkx" });

export const css: (...args: CSSInterpolation[]) => string = instance.css;

export const cx: (...classNames: CxToken[]) => string[] = instance.cx;

export const injectGlobal: (...args: CSSInterpolation[]) => void = instance.injectGlobal;

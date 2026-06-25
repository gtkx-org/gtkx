import { createInstance, type Instance } from "./create-instance.js";

export { registerProviderForDefaultDisplay } from "./provider.js";

const instance = createInstance();

export const css: Instance["css"] = instance.css;
export const cx: Instance["cx"] = instance.cx;
export const injectGlobal: Instance["injectGlobal"] = instance.injectGlobal;

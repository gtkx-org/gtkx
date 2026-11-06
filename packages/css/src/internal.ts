import type { Css } from "./create-css.js";
import { instance } from "./instance.js";

const injectGlobalFor: Css["injectGlobalFor"] = instance.injectGlobalFor;

export { attachParsingErrorLogger, registerProviderForDefaultDisplay } from "./provider.js";
export { scopedRule } from "./scoped-rule.js";
export { injectGlobalFor };

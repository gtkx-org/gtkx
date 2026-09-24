import type { GirParameter } from "./parameter.js";

const PARAMETER_DIRECTION_OVERRIDES: Map<string, GirParameter["direction"]> = new Map([
    ["gdk_content_provider_get_value:value", "inout"],
]);

export { PARAMETER_DIRECTION_OVERRIDES };

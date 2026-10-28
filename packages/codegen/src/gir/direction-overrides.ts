import type { GirParameter } from "./parameter.js";

const PARAMETER_DIRECTION_OVERRIDES: Map<string, GirParameter["direction"]> = new Map([
    /* The caller initializes this GValue to select the requested type, but Gdk metadata describes it as a
     * fresh output.
     */
    ["gdk_content_provider_get_value:value", "inout"],
]);

export { PARAMETER_DIRECTION_OVERRIDES };

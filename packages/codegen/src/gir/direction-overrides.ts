import type { GirParameter } from "./parameter.js";

const PARAMETER_DIRECTION_OVERRIDES: Map<string, GirParameter["direction"]> = new Map([
    /* TODO: Keep inout until Gdk GIR describes the caller-initialized GValue input.
     * https://github.com/gtkx-org/gtkx/issues/737
     */
    ["gdk_content_provider_get_value:value", "inout"],
]);

export { PARAMETER_DIRECTION_OVERRIDES };

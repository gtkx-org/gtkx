import type { ParameterTransfer } from "./parameter.js";

const RETURN_TRANSFER_OVERRIDES: Map<string, ParameterTransfer> = new Map([
    ["g_value_reset", "none"],
    ["ostree_sign_get_all", "container"],
]);

export { RETURN_TRANSFER_OVERRIDES };

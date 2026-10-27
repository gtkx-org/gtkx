import type { ParameterTransfer } from "./parameter.js";

const RETURN_TRANSFER_OVERRIDES: Map<string, ParameterTransfer> = new Map([
    /* TODO: Keep borrowed ownership until GObject GIR acknowledges reset returns its input storage.
     * https://github.com/gtkx-org/gtkx/issues/757
     */
    ["g_value_reset", "none"],
    ["ostree_repo_finder_resolve_finish", "container"],
    ["ostree_repo_finder_resolve_all_finish", "container"],
    ["ostree_sign_get_all", "container"],
]);

const PARAMETER_TRANSFER_OVERRIDES: Map<string, ParameterTransfer> = new Map([
    /* These constructors copy the array and take each element, but their metadata transfers the array too.
     */
    ["gdk_content_provider_new_union:providers", "elements"],
    ["gtk_closure_expression_new:params", "elements"],
    ["gtk_try_expression_new:expressions", "elements"],
]);

export { PARAMETER_TRANSFER_OVERRIDES, RETURN_TRANSFER_OVERRIDES };

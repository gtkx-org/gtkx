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
    /* TODO: Keep element-only transfer until Gdk metadata expresses copied arrays with adopted elements.
     * https://github.com/gtkx-org/gtkx/issues/747
     */
    ["gdk_content_provider_new_union:providers", "elements"],
    /* TODO: Keep both entries until Gtk metadata expresses copied arrays with adopted expression elements.
     * https://github.com/gtkx-org/gtkx/issues/748
     */
    ["gtk_closure_expression_new:params", "elements"],
    ["gtk_try_expression_new:expressions", "elements"],
]);

export { PARAMETER_TRANSFER_OVERRIDES, RETURN_TRANSFER_OVERRIDES };

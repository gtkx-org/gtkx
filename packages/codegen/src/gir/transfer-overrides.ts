import type { ParameterTransfer } from "./parameter.js";

const RETURN_TRANSFER_OVERRIDES: Map<string, ParameterTransfer> = new Map([
    ["ostree_repo_finder_resolve_finish", "container"],
    ["ostree_repo_finder_resolve_all_finish", "container"],
    ["ostree_sign_get_all", "container"],
]);

const PARAMETER_TRANSFER_OVERRIDES: Map<string, ParameterTransfer> = new Map([
    /* This constructor copies the array and takes each element, but its metadata transfers the array too.
     */
    ["gdk_content_provider_new_union:providers", "elements"],
]);

export { PARAMETER_TRANSFER_OVERRIDES, RETURN_TRANSFER_OVERRIDES };

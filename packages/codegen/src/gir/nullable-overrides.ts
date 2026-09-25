import type { GirCallable, GirParameter } from "./parameter.js";

const QUERY_ACTION_NULLABLE_OUTPUTS = ["parameter_type", "state_type", "state_hint", "state"];

const LOADABLE_ICON_NULLABLE_OUTPUTS = ["type"];

const PARAMETERS_MISSING_NULLABLE_ANNOTATION: Map<string, string[]> = new Map([
    /* TODO: Remove once GTK GIR marks the supported null transform reset nullable.
     * https://github.com/gtkx-org/gtkx/issues/755
     */
    ["gtk_fixed_layout_child_set_transform", ["transform"]],
    /* TODO: Remove once GTK GIR marks async Page Setup cancellation nullable.
     * https://github.com/gtkx-org/gtkx/issues/740
     */
    ["GtkPageSetupDoneFunc", ["page_setup"]],
    /* TODO: Remove these function/interface entries once GLib GIR marks absent action outputs nullable.
     * https://github.com/gtkx-org/gtkx/issues/741
     */
    ["g_action_group_query_action", QUERY_ACTION_NULLABLE_OUTPUTS],
    ["Gio.ActionGroupInterface.query_action", QUERY_ACTION_NULLABLE_OUTPUTS],
    /* TODO: Remove once GLib GIR marks exhausted or omitted directory outputs nullable.
     * https://github.com/gtkx-org/gtkx/issues/742
     */
    ["g_file_enumerator_iterate", ["out_info", "out_child"]],
    /* TODO: Remove once GLib GIR marks the EOF line output nullable.
     * https://github.com/gtkx-org/gtkx/issues/745
     */
    ["g_io_channel_read_line", ["str_return"]],
    /* TODO: Remove both entries once GLib GIR marks connected-socket sender addresses nullable.
     * https://github.com/gtkx-org/gtkx/issues/744
     */
    ["g_socket_receive_bytes_from", ["address"]],
    ["g_socket_receive_message", ["address"]],
    /* TODO: Remove once GLib GIR marks the empty-tree path nullable.
     * https://github.com/gtkx-org/gtkx/issues/746
     */
    ["g_settings_backend_flatten_tree", ["path"]],
    /* TODO: Remove these function/interface entries once GLib GIR marks missing icon content types nullable.
     * https://github.com/gtkx-org/gtkx/issues/743
     */
    ["g_loadable_icon_load", LOADABLE_ICON_NULLABLE_OUTPUTS],
    ["g_loadable_icon_load_finish", LOADABLE_ICON_NULLABLE_OUTPUTS],
    ["Gio.LoadableIconIface.load", LOADABLE_ICON_NULLABLE_OUTPUTS],
    ["Gio.LoadableIconIface.load_finish", LOADABLE_ICON_NULLABLE_OUTPUTS],
]);

/* TODO: Remove once supported GLib GIR marks directory exhaustion nullable.
 * https://github.com/gtkx-org/gtkx/issues/739
 */
const RETURNS_MISSING_NULLABLE_ANNOTATION: Set<string> = new Set(["g_dir_read_name"]);

const relaxParameters = (parameters: GirParameter[], names: string[]): void => {
    for (const parameter of parameters) {
        if (names.includes(parameter.name)) {
            parameter.nullable = true;
        }
    }
};

const relaxMissingNullable = (callable: GirCallable, cIdentifier: string | undefined): void => {
    if (cIdentifier === undefined) {
        return;
    }

    const names = PARAMETERS_MISSING_NULLABLE_ANNOTATION.get(cIdentifier);

    if (names !== undefined) {
        relaxParameters(callable.parameters, names);
    }

    if (RETURNS_MISSING_NULLABLE_ANNOTATION.has(cIdentifier)) {
        callable.returnValue.nullable = true;
    }
};

export { relaxMissingNullable };

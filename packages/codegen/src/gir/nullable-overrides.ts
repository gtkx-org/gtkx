import type { GirCallable, GirParameter } from "./parameter.js";

const QUERY_ACTION_NULLABLE_OUTPUTS = ["parameter_type", "state_type", "state_hint", "state"];

const LOADABLE_ICON_NULLABLE_OUTPUTS = ["type"];

const PARAMETERS_MISSING_NULLABLE_ANNOTATION: Map<string, string[]> = new Map([
    ["gtk_fixed_layout_child_set_transform", ["transform"]],
    ["GtkPageSetupDoneFunc", ["page_setup"]],
    ["g_action_group_query_action", QUERY_ACTION_NULLABLE_OUTPUTS],
    ["Gio.ActionGroupInterface.query_action", QUERY_ACTION_NULLABLE_OUTPUTS],
    ["g_file_enumerator_iterate", ["out_info", "out_child"]],
    ["g_io_channel_read_line", ["str_return"]],
    ["g_socket_receive_bytes_from", ["address"]],
    ["g_socket_receive_message", ["address"]],
    ["g_settings_backend_flatten_tree", ["path"]],
    ["g_loadable_icon_load", LOADABLE_ICON_NULLABLE_OUTPUTS],
    ["g_loadable_icon_load_finish", LOADABLE_ICON_NULLABLE_OUTPUTS],
    ["Gio.LoadableIconIface.load", LOADABLE_ICON_NULLABLE_OUTPUTS],
    ["Gio.LoadableIconIface.load_finish", LOADABLE_ICON_NULLABLE_OUTPUTS],
]);

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

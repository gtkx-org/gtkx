import type { GirFunction } from "../../gir/function.js";

const FUNCTIONS_INVOKING_CLOSURE_PARAMETERS: Set<string> = new Set([
    "g_binding_group_bind_with_closures",
    "g_bus_own_name_on_connection_with_closures",
    "g_bus_own_name_with_closures",
    "g_bus_watch_name_on_connection_with_closures",
    "g_bus_watch_name_with_closures",
    "g_dbus_connection_register_object_with_closures",
    "g_dbus_connection_register_object_with_closures2",
    "g_file_copy_async_with_closures",
    "g_file_move_async_with_closures",
    "g_object_bind_property_with_closures",
    "g_settings_bind_with_mapping_closures",
    "g_signal_connect_closure",
    "g_signal_connect_closure_by_id",
    "g_signal_group_connect_closure",
    "g_signal_override_class_closure",
    "g_source_set_closure",
    "gtk_closure_expression_new",
]);

const areClosuresInvoked = (fn: GirFunction): boolean =>
    fn.cIdentifier !== undefined && FUNCTIONS_INVOKING_CLOSURE_PARAMETERS.has(fn.cIdentifier);

export { areClosuresInvoked };

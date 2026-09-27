#include <glib-object.h>

GType gtkx_hash_enum_get_type(void) {
    static gsize type_id;
    if (g_once_init_enter(&type_id)) {
        static const GEnumValue values[] = {
            {0, "GTKX_HASH_ENUM_FIRST", "first"},
            {1, "GTKX_HASH_ENUM_SECOND", "second"},
            {42, "GTKX_HASH_ENUM_LAST", "last"},
            {0, NULL, NULL},
        };
        GType registered = g_enum_register_static("GtkxFixtureHashEnum", values);
        g_once_init_leave(&type_id, registered);
    }
    return type_id;
}

gboolean gtkx_registered_enum_table_matches(GHashTable *table) {
    return g_hash_table_size(table) == 3 &&
        g_hash_table_contains(table, GINT_TO_POINTER(1)) &&
        GPOINTER_TO_INT(g_hash_table_lookup(table, GINT_TO_POINTER(1))) == 0 &&
        GPOINTER_TO_INT(g_hash_table_lookup(table, GINT_TO_POINTER(2))) == 1 &&
        GPOINTER_TO_INT(g_hash_table_lookup(table, GINT_TO_POINTER(3))) == 42;
}

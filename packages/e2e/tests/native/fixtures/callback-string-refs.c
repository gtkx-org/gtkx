#include <glib.h>

typedef void (*GtkxStringRefCallback)(gchar **value);

gboolean gtkx_string_ref_borrowed(const gchar *seed, const gchar *expected, GtkxStringRefCallback callback) {
    gchar *value = (gchar *)seed;
    callback(&value);
    return g_strcmp0(value, expected) == 0;
}

gboolean gtkx_string_ref_full(const gchar *seed, const gchar *expected, GtkxStringRefCallback callback) {
    gchar *value = g_strdup(seed);
    callback(&value);
    gboolean matches = g_strcmp0(value, expected) == 0;
    g_free(value);
    return matches;
}

void gtkx_string_ref_absent(GtkxStringRefCallback callback) {
    callback(NULL);
}

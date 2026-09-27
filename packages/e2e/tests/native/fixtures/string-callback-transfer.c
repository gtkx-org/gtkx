#include <glib.h>

typedef void (*GtkxOwnedStringCallback)(char *value);

void gtkx_string_list_consume(GList *values, GtkxOwnedStringCallback consume) {
    for (GList *item = values; item != NULL; item = item->next) {
        consume(item->data);
    }
    g_list_free(values);
}

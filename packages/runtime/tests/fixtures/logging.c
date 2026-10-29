#include <glib.h>

static gboolean fail_assertion(gpointer data) {
    (void)data;
    g_strv_length(NULL);
    return G_SOURCE_REMOVE;
}

void gtkx_fail_assertion(void) {
    fail_assertion(NULL);
}

void gtkx_fail_assertion_later(void) {
    g_idle_add(fail_assertion, NULL);
}

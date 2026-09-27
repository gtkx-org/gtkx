#include <glib.h>

gboolean gtkx_callback_error_transport(gboolean (*callback)(GError **), GError **error) {
    return callback(error);
}

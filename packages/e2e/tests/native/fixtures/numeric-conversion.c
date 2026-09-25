#include <glib.h>

gint64 gtkx_i64_callback(gint64 initial, gint64 (*callback)(gint64, gint64 *), gint64 *updated) {
    *updated = initial;
    return callback(initial, updated);
}

void gtkx_i64_increment(gint64 *values, guint length) {
    for (guint index = 0; index < length; index++) {
        values[index]++;
    }
}

void gtkx_u64_increment(guint64 *values, guint length) {
    for (guint index = 0; index < length; index++) {
        values[index]++;
    }
}

gint64 gtkx_i64_terminated_sum(const gint64 *values) {
    gint64 result = 0;
    while (*values != 0) {
        result += *values++;
    }
    return result;
}

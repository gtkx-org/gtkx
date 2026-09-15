#include <glib.h>
#include <string.h>

static guint8 contents[] = {0, 49, 255, 51};
static guint8 empty[] = {0};
static guint8 terminated[] = {1, 49, 255, 0};

guint8 *gtkx_u8_result(gint state, guint64 *length) {
    *length = state == 2 ? sizeof(contents) : 0;
    return state == 0 ? NULL : state == 1 ? empty : contents;
}

guint8 *gtkx_u8_terminated(gint state) {
    return state == 0 ? NULL : state == 1 ? empty : terminated;
}

guint8 *gtkx_u8_full(guint64 *length) {
    *length = sizeof(contents);
    return g_memdup2(contents, sizeof(contents));
}

void gtkx_u8_out(gint state, guint8 **value, guint64 *length) {
    *value = gtkx_u8_result(state, length);
}

void gtkx_u8_fill(guint8 *value) {
    memcpy(value, contents, sizeof(contents));
}

guint8 *gtkx_u8_cursor(guint8 *value, guint64 length, guint64 remaining) {
    return value + length - remaining;
}

GArray *gtkx_u8_garray(gint state) {
    if (state == 0) {
        return NULL;
    }
    GArray *array = g_array_new(FALSE, FALSE, sizeof(guint8));
    if (state == 2) {
        g_array_append_vals(array, contents, sizeof(contents));
    }
    return array;
}

void gtkx_u8_garray_out(gint state, GArray **value) {
    *value = gtkx_u8_garray(state);
}

void gtkx_u8_visit(gint state, void (*callback)(guint8 *, guint64)) {
    guint64 length;
    guint8 *value = gtkx_u8_result(state, &length);
    callback(value, length);
}

guint8 *gtkx_u8_callback_return(guint8 *(*callback)(void)) {
    return callback();
}

guint8 *gtkx_u8_callback_ref(gboolean seeded, void (*callback)(guint8 **, guint64 *), guint64 *length) {
    guint8 *value = seeded ? g_memdup2(contents, sizeof(contents)) : NULL;
    *length = seeded ? sizeof(contents) : 0;
    callback(&value, length);
    return value;
}

struct ByteRecord {
    guint8 *items;
};

struct ByteRecord *gtkx_u8_record(gint state) {
    static struct ByteRecord records[] = {{NULL}, {empty}, {terminated}};
    return &records[state];
}

void gtkx_u8_increment(guint8 *value, guint64 length) {
    for (guint64 index = 0; index < length; index++) {
        value[index]++;
    }
}

guint32 gtkx_u8_take(guint8 *value, guint64 length) {
    guint32 total = 0;
    for (guint64 index = 0; index < length; index++) {
        total += value[index];
    }
    g_free(value);
    return total;
}

guint32 gtkx_u8_garray_take(GArray *value) {
    guint32 total = 0;
    for (guint index = 0; index < value->len; index++) {
        total += g_array_index(value, guint8, index);
    }
    g_array_unref(value);
    return total;
}

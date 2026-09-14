#include <gio/gio.h>

static const guint8 contents[] = {0, 49, 255, 51};

GByteArray *gtkx_byte_array_copy(GByteArray *value) {
    if (value == NULL) {
        return NULL;
    }

    return g_byte_array_append(g_byte_array_sized_new(value->len), value->data, value->len);
}

GByteArray *gtkx_byte_array_take(GByteArray *value) {
    GByteArray *result = gtkx_byte_array_copy(value);
    g_clear_pointer(&value, g_byte_array_unref);
    return result;
}

GByteArray *gtkx_byte_array_result(gint state) {
    if (state == 0) {
        return NULL;
    }

    GByteArray *value = g_byte_array_new();
    return state == 1 ? value : g_byte_array_append(value, contents, sizeof(contents));
}

void gtkx_byte_array_out(gint state, GByteArray **value) {
    *value = gtkx_byte_array_result(state);
}

gint gtkx_byte_array_seed(GByteArray **value) {
    if (*value == NULL) {
        return 0;
    }

    const guint8 suffix = 9;
    g_byte_array_append(*value, &suffix, 1);
    return 1;
}

void gtkx_byte_array_visit(gint state, void (*callback)(GByteArray *)) {
    GByteArray *value = gtkx_byte_array_result(state);
    callback(value);
    g_clear_pointer(&value, g_byte_array_unref);
}

GByteArray *gtkx_byte_array_callback_return(GByteArray *(*callback)(void)) {
    return callback();
}

GByteArray *gtkx_byte_array_callback_copy(GByteArray *(*callback)(void)) {
    return gtkx_byte_array_copy(callback());
}

GByteArray *gtkx_byte_array_callback_ref(gint state, void (*callback)(GByteArray **)) {
    if (state == 3) {
        callback(NULL);
        return NULL;
    }

    GByteArray *value = gtkx_byte_array_result(state);
    callback(&value);
    return value;
}

GByteArray **gtkx_byte_array_record_new(void) {
    return g_new0(GByteArray *, 1);
}

void gtkx_byte_array_record_free(GByteArray **record) {
    g_clear_pointer(record, g_byte_array_unref);
    g_free(record);
}

static gboolean complete_bytes(gpointer data) {
    GTask *task = data;
    g_task_return_pointer(task, gtkx_byte_array_copy(g_task_get_task_data(task)),
                          (GDestroyNotify) g_byte_array_unref);
    return G_SOURCE_REMOVE;
}

void gtkx_byte_array_async(GByteArray *value, GAsyncReadyCallback callback, gpointer data) {
    GTask *task = g_task_new(NULL, NULL, callback, data);
    g_task_set_task_data(task, value, NULL);
    g_idle_add_full(G_PRIORITY_DEFAULT, complete_bytes, task, g_object_unref);
}

GByteArray *gtkx_byte_array_finish(GAsyncResult *result) {
    return g_task_propagate_pointer(G_TASK(result), NULL);
}

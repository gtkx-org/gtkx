#include <glib-object.h>

typedef struct {
    gint value;
} GtkxSeparateValue;

typedef struct {
    gpointer values;
    gpointer alias;
    guint layout;
    guint kind;
} GtkxSeparateHolder;

typedef void (*GtkxSeparateCallback)(gpointer *values);

static guint releases[3];

static void object_finalized(gpointer data, GObject *object) {
    (void)data;
    (void)object;
    releases[1]++;
}

gpointer gtkx_separate_value_copy(gconstpointer value) {
    return g_memdup2(value, sizeof(GtkxSeparateValue));
}

void gtkx_separate_value_free(gpointer value) {
    releases[2]++;
    g_free(value);
}

gpointer gtkx_separate_input_new(guint kind, gint contents) {
    if (kind == 1) {
        GObject *object = g_object_new(G_TYPE_OBJECT, NULL);
        g_object_set_data(object, "gtkx-separate-value", GINT_TO_POINTER(contents));
        g_object_weak_ref(object, object_finalized, NULL);
        return object;
    }
    GtkxSeparateValue *value = g_new(GtkxSeparateValue, 1);
    value->value = contents;
    return value;
}

gint gtkx_separate_input_get(guint kind, gpointer value) {
    if (kind == 1) return GPOINTER_TO_INT(g_object_get_data(value, "gtkx-separate-value"));
    return ((GtkxSeparateValue *)value)->value;
}

guint gtkx_separate_releases(guint kind) {
    return releases[kind];
}

static guint count(guint layout, gpointer values) {
    if (values == NULL) return 0;
    return layout == 0 ? ((GPtrArray *)values)->len : ((GArray *)values)->len;
}

static gpointer item_at(guint layout, gpointer values, guint index) {
    if (layout == 0) return g_ptr_array_index((GPtrArray *)values, index);
    return g_array_index((GArray *)values, gpointer, index);
}

static void append(guint layout, gpointer values, gpointer item) {
    if (layout == 0) g_ptr_array_add(values, item);
    else g_array_append_val((GArray *)values, item);
}

static gpointer container_new(guint layout) {
    if (layout == 0) return g_ptr_array_new();
    return g_array_new(FALSE, FALSE, sizeof(gpointer));
}

static void unref(guint layout, gpointer values) {
    if (layout == 0) g_ptr_array_unref(values);
    else g_array_unref(values);
}

static void container_free(guint layout, guint kind, gpointer values) {
    if (values == NULL) return;
    for (guint i = 0; i < count(layout, values); i++) {
        gpointer item = item_at(layout, values, i);
        if (kind == 0) g_free(item);
        else if (kind == 1) g_object_unref(item);
        else gtkx_separate_value_free(item);
    }
    unref(layout, values);
}

GtkxSeparateHolder *gtkx_separate_holder_new(guint layout, guint kind, guint state) {
    GtkxSeparateHolder *holder = g_new0(GtkxSeparateHolder, 1);
    holder->layout = layout;
    holder->kind = kind;
    if (state == 0) return holder;
    holder->values = container_new(layout);
    if (state == 2) {
        for (guint i = 0; i < 2; i++) {
            gpointer item = kind == 0
                ? g_strdup(i == 0 ? "\357\273\277caf\303\251" : "\342\231\245")
                : gtkx_separate_input_new(kind, i == 0 ? 3 : 7);
            append(layout, holder->values, item);
        }
    }
    return holder;
}

void gtkx_separate_holder_free(GtkxSeparateHolder *holder) {
    container_free(holder->layout, holder->kind, holder->values);
    container_free(holder->layout, holder->kind, holder->alias);
    g_free(holder);
}

void gtkx_separate_holder_keep_object_alias(GtkxSeparateHolder *holder) {
    for (guint i = 0; i < count(holder->layout, holder->values); i++) {
        g_object_ref(item_at(holder->layout, holder->values, i));
    }
    if (holder->layout == 0) holder->alias = g_ptr_array_ref(holder->values);
    else holder->alias = g_array_ref(holder->values);
}

guint gtkx_separate_holder_count(GtkxSeparateHolder *holder, gboolean alias) {
    return count(holder->layout, alias ? holder->alias : holder->values);
}

gboolean gtkx_separate_holder_is_null(GtkxSeparateHolder *holder) {
    return holder->values == NULL;
}

gint gtkx_separate_holder_get(GtkxSeparateHolder *holder, gboolean alias, guint index) {
    gpointer values = alias ? holder->alias : holder->values;
    return gtkx_separate_input_get(holder->kind, item_at(holder->layout, values, index));
}

const gchar *gtkx_separate_holder_get_string(GtkxSeparateHolder *holder, guint index) {
    return item_at(holder->layout, holder->values, index);
}

void gtkx_separate_holder_visit(GtkxSeparateHolder *holder, GtkxSeparateCallback callback) {
    callback(&holder->values);
}

typedef void (*GtkxSeparateVoidCallback)(void);
typedef void (*GtkxSeparateOwnedCallback)(gpointer values);

static gpointer holder_take(GtkxSeparateHolder *holder) {
    gpointer values = holder->values;
    holder->values = NULL;
    return values;
}

gpointer gtkx_separate_holder_return_after_callback(GtkxSeparateHolder *holder, GtkxSeparateVoidCallback callback) {
    callback();
    return holder_take(holder);
}

void gtkx_separate_holder_out_after_callback(GtkxSeparateHolder *holder, GtkxSeparateVoidCallback callback,
                                           gpointer *values) {
    callback();
    *values = holder_take(holder);
}

void gtkx_separate_visit_owned(guint layout, guint kind, GtkxSeparateOwnedCallback callback) {
    for (guint i = 0; i < 2; i++) {
        GtkxSeparateHolder *holder = gtkx_separate_holder_new(layout, kind, 2);
        gpointer values = holder_take(holder);
        gtkx_separate_holder_free(holder);
        callback(values);
    }
}

typedef void (*GtkxSeparateOwnedDataCallback)(gpointer values, gpointer data);

typedef struct {
    guint layout;
    GtkxSeparateOwnedDataCallback callback;
    gpointer data;
    GDestroyNotify destroy;
} GtkxSeparateIdle;

static gboolean dispatch_owned_idle(gpointer data) {
    GtkxSeparateIdle *idle = data;
    for (guint i = 0; i < 2; i++) {
        GtkxSeparateHolder *holder = gtkx_separate_holder_new(idle->layout, 1, 2);
        gpointer values = holder_take(holder);
        gtkx_separate_holder_free(holder);
        idle->callback(values, idle->data);
    }
    return G_SOURCE_REMOVE;
}

static void free_owned_idle(gpointer data) {
    GtkxSeparateIdle *idle = data;
    idle->destroy(idle->data);
    g_free(idle);
}

guint gtkx_separate_schedule_owned(guint layout, GtkxSeparateOwnedDataCallback callback,
                                  gpointer data, GDestroyNotify destroy) {
    GtkxSeparateIdle *idle = g_new(GtkxSeparateIdle, 1);
    idle->layout = layout;
    idle->callback = callback;
    idle->data = data;
    idle->destroy = destroy;
    return g_idle_add_full(G_PRIORITY_DEFAULT_IDLE, dispatch_owned_idle, idle, free_owned_idle);
}

void gtkx_separate_cancel_idle(guint source_id) {
    GSource *source = g_main_context_find_source_by_id(g_main_context_default(), source_id);
    if (source != NULL) g_source_destroy(source);
}

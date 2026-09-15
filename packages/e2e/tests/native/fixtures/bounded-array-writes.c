#include <glib-object.h>

typedef struct {
    gint value;
} GtkxBoundedValue;

typedef struct {
    gpointer *values;
    guint length;
    guint kind;
} GtkxBoundedHolder;

typedef void (*GtkxBoundedCallback)(gpointer **values, guint *length);

static guint finalized_objects;
static guint freed_values;

static void object_finalized(gpointer data, GObject *object) {
    (void)data;
    (void)object;
    finalized_objects++;
}

GObject *gtkx_bounded_object_new(gint value) {
    GObject *object = g_object_new(G_TYPE_OBJECT, NULL);
    g_object_set_data(object, "gtkx-bounded-value", GINT_TO_POINTER(value));
    g_object_weak_ref(object, object_finalized, NULL);
    return object;
}

gint gtkx_bounded_object_value(GObject *object) {
    return GPOINTER_TO_INT(g_object_get_data(object, "gtkx-bounded-value"));
}

GtkxBoundedValue *gtkx_bounded_value_new(gint value) {
    GtkxBoundedValue *result = g_new(GtkxBoundedValue, 1);
    result->value = value;
    return result;
}

GtkxBoundedValue *gtkx_bounded_value_copy(const GtkxBoundedValue *value) {
    return g_memdup2(value, sizeof(*value));
}

void gtkx_bounded_value_free(gpointer value) {
    freed_values++;
    g_free(value);
}

gint gtkx_bounded_value_get(const GtkxBoundedValue *value) {
    return value->value;
}

guint gtkx_bounded_freed_values(void) {
    return freed_values;
}

guint gtkx_bounded_finalized_objects(void) {
    return finalized_objects;
}

GtkxBoundedHolder *gtkx_bounded_holder_new(guint kind, guint length, gboolean allocated) {
    GtkxBoundedHolder *holder = g_new0(GtkxBoundedHolder, 1);
    holder->kind = kind;
    holder->length = length;
    if (allocated) {
        holder->values = g_new0(gpointer, MAX(length, 1));
        for (guint i = 0; i < length; i++) {
            if (kind == 0) {
                holder->values[i] = g_strdup(i == 0 ? "\357\273\277caf\303\251" : "\342\231\245");
            } else if (kind == 1) {
                holder->values[i] = gtkx_bounded_object_new(i == 0 ? 3 : 7);
            } else {
                holder->values[i] = gtkx_bounded_value_new(i == 0 ? 3 : 7);
            }
        }
    }
    return holder;
}

void gtkx_bounded_holder_clear(GtkxBoundedHolder *holder) {
    const GDestroyNotify destroy[] = { g_free, g_object_unref, gtkx_bounded_value_free };
    if (holder->values != NULL) {
        for (guint i = 0; i < holder->length; i++) {
            destroy[holder->kind](holder->values[i]);
        }
        g_free(holder->values);
    }
    holder->values = NULL;
    holder->length = 0;
}

void gtkx_bounded_holder_free(GtkxBoundedHolder *holder) {
    gtkx_bounded_holder_clear(holder);
    g_free(holder);
}

guint gtkx_bounded_holder_count(const GtkxBoundedHolder *holder) {
    return holder->values == NULL ? 0 : holder->length;
}

const gchar *gtkx_bounded_holder_string(const GtkxBoundedHolder *holder, guint index) {
    return holder->values[index];
}

gint gtkx_bounded_holder_value(const GtkxBoundedHolder *holder, guint index) {
    return holder->kind == 1 ? gtkx_bounded_object_value(holder->values[index])
                             : gtkx_bounded_value_get(holder->values[index]);
}

void gtkx_bounded_holder_visit(GtkxBoundedHolder *holder, GtkxBoundedCallback callback) {
    callback(&holder->values, &holder->length);
}

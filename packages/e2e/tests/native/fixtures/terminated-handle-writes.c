#include <glib-object.h>

typedef struct {
    gint value;
} GtkxTerminatedValue;

typedef struct {
    guint references;
    gint value;
} GtkxTerminatedReference;

typedef struct {
    gpointer *values;
    guint kind;
} GtkxTerminatedHolder;

typedef void (*GtkxTerminatedCallback)(gpointer **values);

static guint releases[4];

static void object_finalized(gpointer data, GObject *object) {
    (void)data;
    (void)object;
    releases[0]++;
}

gpointer gtkx_terminated_value_copy(gconstpointer value) {
    return g_memdup2(value, sizeof(GtkxTerminatedValue));
}

void gtkx_terminated_value_free(gpointer value) {
    releases[1]++;
    g_free(value);
}

static gpointer boxed_copy(gpointer value) {
    return gtkx_terminated_value_copy(value);
}

static void boxed_free(gpointer value) {
    releases[2]++;
    g_free(value);
}

GType gtkx_terminated_value_get_type(void) {
    static GType type;
    if (type == 0) {
        type = g_boxed_type_register_static("GtkxTerminatedValue", boxed_copy, boxed_free);
    }
    return type;
}

gpointer gtkx_terminated_reference_ref(gpointer data) {
    GtkxTerminatedReference *value = data;
    value->references++;
    return data;
}

void gtkx_terminated_reference_unref(gpointer data) {
    GtkxTerminatedReference *value = data;
    if (--value->references == 0) {
        releases[3]++;
        g_free(value);
    }
}

gpointer gtkx_terminated_item_new(guint kind, gint contents) {
    if (kind == 0) {
        GObject *object = g_object_new(G_TYPE_OBJECT, NULL);
        g_object_set_data(object, "gtkx-terminated-value", GINT_TO_POINTER(contents));
        g_object_weak_ref(object, object_finalized, NULL);
        return object;
    }
    if (kind == 3) {
        GtkxTerminatedReference *value = g_new(GtkxTerminatedReference, 1);
        value->references = 1;
        value->value = contents;
        return value;
    }
    GtkxTerminatedValue *value = g_new(GtkxTerminatedValue, 1);
    value->value = contents;
    return value;
}

gint gtkx_terminated_item_value(guint kind, gconstpointer data) {
    if (kind == 0) {
        return GPOINTER_TO_INT(g_object_get_data((GObject *)data, "gtkx-terminated-value"));
    }
    if (kind == 3) {
        return ((const GtkxTerminatedReference *)data)->value;
    }
    return ((const GtkxTerminatedValue *)data)->value;
}

guint gtkx_terminated_releases(guint kind) {
    return releases[kind];
}

GtkxTerminatedHolder *gtkx_terminated_holder_new(guint kind, guint state) {
    GtkxTerminatedHolder *holder = g_new0(GtkxTerminatedHolder, 1);
    holder->kind = kind;
    if (state != 0) {
        guint length = state == 2 ? 2 : 0;
        holder->values = g_new0(gpointer, length + 1);
        for (guint i = 0; i < length; i++) {
            holder->values[i] = gtkx_terminated_item_new(kind, i == 0 ? 3 : 7);
        }
    }
    return holder;
}

void gtkx_terminated_holder_clear(GtkxTerminatedHolder *holder) {
    const GDestroyNotify destroy[] = {
        g_object_unref, gtkx_terminated_value_free, boxed_free, gtkx_terminated_reference_unref
    };
    if (holder->values != NULL) {
        for (guint i = 0; holder->values[i] != NULL; i++) {
            destroy[holder->kind](holder->values[i]);
        }
        g_free(holder->values);
    }
    holder->values = NULL;
}

void gtkx_terminated_holder_free(GtkxTerminatedHolder *holder) {
    gtkx_terminated_holder_clear(holder);
    g_free(holder);
}

guint gtkx_terminated_holder_count(const GtkxTerminatedHolder *holder) {
    guint length = 0;
    if (holder->values != NULL) {
        while (holder->values[length] != NULL) {
            length++;
        }
    }
    return length;
}

gint gtkx_terminated_holder_value(const GtkxTerminatedHolder *holder, guint index) {
    return gtkx_terminated_item_value(holder->kind, holder->values[index]);
}

void gtkx_terminated_holder_visit(GtkxTerminatedHolder *holder, GtkxTerminatedCallback callback) {
    callback(&holder->values);
}

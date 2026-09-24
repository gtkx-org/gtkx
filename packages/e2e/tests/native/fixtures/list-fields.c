#include <glib-object.h>

typedef struct {
    gint value;
} GtkxListValue;

typedef struct {
    gpointer values;
    gboolean singly;
    guint kind;
} GtkxListHolder;

typedef void (*GtkxListCallback)(gpointer *values);

static guint finalized_objects;
static guint freed_values;

static void object_finalized(gpointer data, GObject *object) {
    (void)data;
    (void)object;
    finalized_objects++;
}

static GObject *list_object(gint value) {
    GObject *object = g_object_new(G_TYPE_OBJECT, NULL);
    g_object_set_data(object, "gtkx-list-value", GINT_TO_POINTER(value));
    g_object_weak_ref(object, object_finalized, NULL);
    return object;
}

gint gtkx_list_object_value(GObject *object) {
    return GPOINTER_TO_INT(g_object_get_data(object, "gtkx-list-value"));
}

guint gtkx_list_finalized_objects(void) {
    return finalized_objects;
}

GtkxListValue *gtkx_list_value_copy(const GtkxListValue *value) {
    return g_memdup2(value, sizeof(*value));
}

void gtkx_list_value_free(gpointer value) {
    freed_values++;
    g_free(value);
}

gint gtkx_list_value_get(const GtkxListValue *value) {
    return value->value;
}

guint gtkx_list_freed_values(void) {
    return freed_values;
}

static gpointer list_item(guint kind, guint index) {
    if (kind == 0) {
        return g_strdup(index == 0 ? "\357\273\277caf\303\251" : "\342\231\245");
    }
    if (kind == 1) {
        return list_object(index == 0 ? 3 : 7);
    }
    GtkxListValue *value = g_new(GtkxListValue, 1);
    value->value = index == 0 ? 3 : 7;
    return value;
}

GtkxListHolder *gtkx_list_holder_new(gboolean singly, guint kind, gboolean populated) {
    GtkxListHolder *holder = g_new0(GtkxListHolder, 1);
    holder->singly = singly;
    holder->kind = kind;
    if (populated) {
        for (guint i = 0; i < 2; i++) {
            gpointer item = list_item(kind, i);
            holder->values = singly ? (gpointer)g_slist_append(holder->values, item)
                                    : (gpointer)g_list_append(holder->values, item);
        }
    }
    return holder;
}

void gtkx_list_holder_free(GtkxListHolder *holder) {
    const GDestroyNotify destroy[] = { g_free, g_object_unref, gtkx_list_value_free };
    if (holder->singly) {
        g_slist_free_full(holder->values, destroy[holder->kind]);
    } else {
        g_list_free_full(holder->values, destroy[holder->kind]);
    }
    g_free(holder);
}

guint gtkx_list_holder_count(const GtkxListHolder *holder) {
    return holder->singly ? g_slist_length(holder->values) : g_list_length(holder->values);
}

void gtkx_list_holder_visit(GtkxListHolder *holder, GtkxListCallback callback) {
    callback(&holder->values);
}

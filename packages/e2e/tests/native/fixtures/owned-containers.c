#include <glib-object.h>

typedef struct {
    gint value;
} GtkxOwnedRecord;

typedef struct {
    gpointer values;
    gpointer alias;
    guint layout;
    guint kind;
} GtkxOwnedHolder;

typedef void (*GtkxOwnedCallback)(gpointer *values);

static guint finalized_objects;
static guint freed_records;

static void object_finalized(gpointer data, GObject *object) {
    (void)data;
    (void)object;
    finalized_objects++;
}

GObject *gtkx_owned_object_new(gint value) {
    GObject *object = g_object_new(G_TYPE_OBJECT, NULL);
    g_object_set_data(object, "gtkx-owned-value", GINT_TO_POINTER(value));
    g_object_weak_ref(object, object_finalized, NULL);
    return object;
}

gint gtkx_owned_object_value(GObject *object) {
    return GPOINTER_TO_INT(g_object_get_data(object, "gtkx-owned-value"));
}

guint gtkx_owned_finalized_objects(void) {
    return finalized_objects;
}

void gtkx_owned_record_free(gpointer value) {
    freed_records++;
    g_free(value);
}

guint gtkx_owned_freed_records(void) {
    return freed_records;
}

static void free_string_slot(gpointer slot) {
    g_free(*(gpointer *)slot);
}

static void unref_object(gpointer object) {
    g_object_unref(object);
}

static void unref_object_slot(gpointer slot) {
    g_object_unref(*(gpointer *)slot);
}

static void free_record_slot(gpointer slot) {
    gtkx_owned_record_free(*(gpointer *)slot);
}

static gpointer array_ref(guint layout, gpointer array) {
    if (array == NULL) return NULL;
    return layout == 0 ? (gpointer)g_ptr_array_ref(array) : (gpointer)g_array_ref(array);
}

static void array_unref(guint layout, gpointer array) {
    if (array == NULL) return;
    if (layout == 0) g_ptr_array_unref(array);
    else g_array_unref(array);
}

static gpointer array_new(guint layout, guint kind) {
    if (layout == 0) {
        GDestroyNotify destroy = kind == 0 ? g_free :
            kind == 1 ? unref_object : kind == 3 ? gtkx_owned_record_free : NULL;
        return g_ptr_array_new_with_free_func(destroy);
    }
    GArray *array = g_array_new(FALSE, FALSE, kind == 2 ? sizeof(gint) : sizeof(gpointer));
    GDestroyNotify clear = kind == 0 ? free_string_slot :
        kind == 1 ? unref_object_slot : kind == 3 ? free_record_slot : NULL;
    g_array_set_clear_func(array, clear);
    return array;
}

static void append_initial(GtkxOwnedHolder *holder, guint index) {
    gint number = index == 0 ? 3 : 7;
    gpointer value;
    if (holder->kind == 0) {
        value = g_strdup(index == 0 ? "\357\273\277caf\303\251" : "\342\231\245");
    } else if (holder->kind == 1) {
        value = gtkx_owned_object_new(number);
    } else if (holder->kind == 3) {
        GtkxOwnedRecord *record = g_new(GtkxOwnedRecord, 1);
        record->value = number;
        value = record;
    } else {
        value = GINT_TO_POINTER(number);
    }
    if (holder->layout == 0) {
        g_ptr_array_add(holder->values, value);
    } else if (holder->kind == 2) {
        g_array_append_vals(holder->values, &number, 1);
    } else {
        g_array_append_vals(holder->values, &value, 1);
    }
}

GtkxOwnedHolder *gtkx_owned_holder_new(guint layout, guint kind, guint state) {
    GtkxOwnedHolder *holder = g_new0(GtkxOwnedHolder, 1);
    holder->layout = layout;
    holder->kind = kind;
    if (state != 0) {
        holder->values = array_new(layout, kind);
        if (state == 2) {
            append_initial(holder, 0);
            append_initial(holder, 1);
        }
        holder->alias = array_ref(layout, holder->values);
    }
    return holder;
}

void gtkx_owned_holder_clear(GtkxOwnedHolder *holder) {
    gpointer previous = holder->values;
    holder->values = NULL;
    array_unref(holder->layout, previous);
}

void gtkx_owned_holder_release_alias(GtkxOwnedHolder *holder) {
    gpointer previous = holder->alias;
    holder->alias = NULL;
    array_unref(holder->layout, previous);
}

void gtkx_owned_holder_free(GtkxOwnedHolder *holder) {
    gtkx_owned_holder_clear(holder);
    gtkx_owned_holder_release_alias(holder);
    g_free(holder);
}

gpointer gtkx_owned_holder_return(GtkxOwnedHolder *holder) {
    return array_ref(holder->layout, holder->values);
}

gpointer gtkx_owned_holder_peek(GtkxOwnedHolder *holder) {
    return holder->values;
}

guint gtkx_owned_holder_count(GtkxOwnedHolder *holder, gboolean alias) {
    gpointer array = alias ? holder->alias : holder->values;
    if (array == NULL) return 0;
    return holder->layout == 0 ? ((GPtrArray *)array)->len : ((GArray *)array)->len;
}

static gpointer item_at(GtkxOwnedHolder *holder, gboolean alias, guint index) {
    gpointer array = alias ? holder->alias : holder->values;
    if (holder->layout == 0) return g_ptr_array_index((GPtrArray *)array, index);
    if (holder->kind == 2) return GINT_TO_POINTER(g_array_index((GArray *)array, gint, index));
    return g_array_index((GArray *)array, gpointer, index);
}

const gchar *gtkx_owned_holder_string(GtkxOwnedHolder *holder, gboolean alias, guint index) {
    return item_at(holder, alias, index);
}

gint gtkx_owned_holder_number(GtkxOwnedHolder *holder, gboolean alias, guint index) {
    gpointer value = item_at(holder, alias, index);
    if (holder->kind == 1) return gtkx_owned_object_value(value);
    if (holder->kind == 3) return ((GtkxOwnedRecord *)value)->value;
    return GPOINTER_TO_INT(value);
}

void gtkx_owned_holder_visit(GtkxOwnedHolder *holder, GtkxOwnedCallback callback) {
    callback(&holder->values);
}

void gtkx_owned_holder_install(GtkxOwnedHolder *holder, gpointer values, gboolean take) {
    gtkx_owned_holder_clear(holder);
    gtkx_owned_holder_release_alias(holder);
    holder->values = take ? values : array_ref(holder->layout, values);
    holder->alias = array_ref(holder->layout, holder->values);
}

#include <glib-object.h>

typedef struct {
    gint value;
} GtkxArrayValue;

typedef struct {
    guint references;
    gint value;
} GtkxArrayReference;

typedef void (*GtkxArraySeedCallback)(gpointer *values, guint *length);

static guint releases[4];

static void string_free(gpointer value) {
    releases[0]++;
    g_free(value);
}

static void object_finalized(gpointer data, GObject *object) {
    (void)data;
    (void)object;
    releases[1]++;
}

gpointer gtkx_array_value_copy(gconstpointer value) {
    return g_memdup2(value, sizeof(GtkxArrayValue));
}

void gtkx_array_value_free(gpointer value) {
    releases[2]++;
    g_free(value);
}

static gpointer boxed_copy(gpointer value) {
    return gtkx_array_value_copy(value);
}

GType gtkx_array_value_get_type(void) {
    static GType type;
    if (type == 0) {
        type = g_boxed_type_register_static("GtkxArraySeedValue", boxed_copy, gtkx_array_value_free);
    }
    return type;
}

gpointer gtkx_array_reference_ref(gpointer data) {
    GtkxArrayReference *value = data;
    value->references++;
    return data;
}

void gtkx_array_reference_unref(gpointer data) {
    GtkxArrayReference *value = data;
    if (--value->references == 0) {
        releases[3]++;
        g_free(value);
    }
}

gint gtkx_array_value_get(const GtkxArrayValue *value) {
    return value->value;
}

gint gtkx_array_reference_get(const GtkxArrayReference *value) {
    return value->value;
}

gint gtkx_array_object_get(GObject *object) {
    return GPOINTER_TO_INT(g_object_get_data(object, "gtkx-array-value"));
}

guint gtkx_array_seed_releases(guint kind) {
    return releases[kind];
}

static gpointer item_new(guint kind, guint index) {
    gint contents = index == 0 ? 3 : 7;
    if (kind == 0) {
        return g_strdup(index == 0 ? "\357\273\277caf\303\251" : "\342\231\245");
    }
    if (kind == 1) {
        GObject *object = g_object_new(G_TYPE_OBJECT, NULL);
        g_object_set_data(object, "gtkx-array-value", GINT_TO_POINTER(contents));
        g_object_weak_ref(object, object_finalized, NULL);
        return object;
    }
    if (kind == 2) {
        GtkxArrayValue *value = g_new(GtkxArrayValue, 1);
        value->value = contents;
        return value;
    }
    GtkxArrayReference *value = g_new(GtkxArrayReference, 1);
    value->references = 1;
    value->value = contents;
    return value;
}

static void clear_string(gpointer slot) {
    string_free(*(gpointer *)slot);
}

static void clear_object(gpointer slot) {
    g_object_unref(*(gpointer *)slot);
}

static void clear_value(gpointer slot) {
    gtkx_array_value_free(*(gpointer *)slot);
}

static void clear_reference(gpointer slot) {
    gtkx_array_reference_unref(*(gpointer *)slot);
}

static const GDestroyNotify item_free[] = {
    string_free, g_object_unref, gtkx_array_value_free, gtkx_array_reference_unref
};

static gpointer container_new(guint layout, guint kind, guint length) {
    if (layout == 3) {
        GPtrArray *values = g_ptr_array_new_full(length, item_free[kind]);
        for (guint i = 0; i < length; i++) {
            g_ptr_array_add(values, item_new(kind, i));
        }
        return values;
    }
    if (layout == 4) {
        const GDestroyNotify clear[] = { clear_string, clear_object, clear_value, clear_reference };
        GArray *values = g_array_sized_new(FALSE, FALSE, sizeof(gpointer), length);
        g_array_set_clear_func(values, clear[kind]);
        for (guint i = 0; i < length; i++) {
            gpointer item = item_new(kind, i);
            g_array_append_val(values, item);
        }
        return values;
    }
    gpointer *values = g_new0(gpointer, MAX(length + (layout == 2), 1));
    for (guint i = 0; i < length; i++) {
        values[i] = item_new(kind, i);
    }
    return values;
}

static void container_free(guint layout, guint kind, gpointer values, guint length) {
    if (values == NULL) {
        return;
    }
    if (layout == 3) {
        g_ptr_array_unref(values);
    } else if (layout == 4) {
        g_array_unref(values);
    } else {
        gpointer *items = values;
        for (guint i = 0; i < length; i++) {
            item_free[kind](items[i]);
        }
        g_free(values);
    }
}

void gtkx_array_seed(guint layout, guint kind, guint state, GtkxArraySeedCallback callback) {
    guint length = state == 2 ? 2 : 0;
    gpointer values = state == 0 ? NULL : container_new(layout, kind, length);
    callback(&values, &length);
    container_free(layout, kind, values, length);
}

void gtkx_array_inline_seed(GtkxArraySeedCallback callback) {
    guint length = 2;
    GtkxArrayValue *items = g_new(GtkxArrayValue, length);
    items[0].value = 3;
    items[1].value = 7;
    gpointer values = items;
    callback(&values, &length);
    g_free(values);
}

typedef struct {
    gpointer *values;
} GtkxNestedArray;

GtkxNestedArray *gtkx_nested_array_new(void) {
    GtkxNestedArray *record = g_new(GtkxNestedArray, 1);
    record->values = g_new0(gpointer, 2);
    record->values[0] = container_new(2, 1, 2);
    return record;
}

void gtkx_nested_array_free(GtkxNestedArray *record) {
    container_free(2, 1, record->values[0], 2);
    g_free(record->values);
    g_free(record);
}

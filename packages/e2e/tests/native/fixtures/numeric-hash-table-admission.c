#include <glib-object.h>
#include <stddef.h>

typedef GHashTable *(*GtkxNumericTableReturn)(void);
typedef void (*GtkxNumericTableOutput)(GHashTable **table);
typedef GPtrArray *(*GtkxNumericTableArrayReturn)(void);
typedef void (*GtkxNumericTableInput)(GHashTable *table);

GHashTable *gtkx_numeric_table_values(guint kind) {
    GHashTable *table = g_hash_table_new_full(g_str_hash, g_str_equal, g_free, g_free);
    gpointer value;
    switch (kind) {
    case 0: {
        const gint64 number = -9007199254740993LL;
        value = g_memdup2(&number, sizeof(number));
        break;
    }
    case 1: {
        const guint64 number = 9007199254740993ULL;
        value = g_memdup2(&number, sizeof(number));
        break;
    }
    case 2: {
        const gfloat number = 1.5f;
        value = g_memdup2(&number, sizeof(number));
        break;
    }
    default: {
        const gdouble number = -2.25;
        value = g_memdup2(&number, sizeof(number));
        break;
    }
    }
    g_hash_table_insert(table, g_strdup("value"), value);
    return table;
}

gsize gtkx_numeric_table_slot_size(void) {
    return sizeof(GHashTable *);
}

void gtkx_numeric_table_fill_slot(GHashTable **table, guint kind) {
    *table = gtkx_numeric_table_values(kind);
}

void gtkx_numeric_table_visit_owned(guint kind, GtkxNumericTableInput callback) {
    callback(gtkx_numeric_table_values(kind));
}

GHashTable *gtkx_numeric_table_ref_callback(GtkxNumericTableReturn callback) {
    return g_hash_table_ref(callback());
}

gboolean gtkx_numeric_table_accept_return(GtkxNumericTableReturn callback) {
    return callback != NULL;
}

gboolean gtkx_numeric_table_accept_output(GtkxNumericTableOutput callback) {
    return callback != NULL;
}

gboolean gtkx_numeric_table_accept_array_return(GtkxNumericTableArrayReturn callback) {
    return callback != NULL;
}

void gtkx_numeric_key_ignore(GHashTable *table) {
    (void)table;
}

void gtkx_numeric_key_consume(GHashTable *table) {
    if (table != NULL) {
        g_hash_table_unref(table);
    }
}

GHashTable *gtkx_numeric_key_null(void) {
    return NULL;
}

void gtkx_numeric_key_null_output(GHashTable **table) {
    *table = NULL;
}

gboolean gtkx_numeric_key_accept_input(GtkxNumericTableInput callback) {
    return callback != NULL;
}

typedef struct {
    GObject parent;
} GtkxNumericTableSource;

typedef struct {
    GObjectClass parent_class;
    GHashTable *(*read)(GtkxNumericTableSource *self);
    void (*fill)(GtkxNumericTableSource *self, GHashTable **table);
    GHashTable *(*read_keys)(GtkxNumericTableSource *self);
    void (*fill_keys)(GtkxNumericTableSource *self, GHashTable **table);
} GtkxNumericTableSourceClass;

G_DEFINE_TYPE(GtkxNumericTableSource, gtkx_numeric_table_source, G_TYPE_OBJECT)

static GHashTable *read_table(GtkxNumericTableSource *self) {
    (void)self;
    return gtkx_numeric_table_values(1);
}

static void fill_table(GtkxNumericTableSource *self, GHashTable **table) {
    (void)self;
    *table = gtkx_numeric_table_values(1);
}

static GHashTable *read_keys(GtkxNumericTableSource *self) {
    (void)self;
    return NULL;
}

static void fill_keys(GtkxNumericTableSource *self, GHashTable **table) {
    (void)self;
    *table = NULL;
}

static void gtkx_numeric_table_source_init(GtkxNumericTableSource *self) {
    (void)self;
}

static void gtkx_numeric_table_source_class_init(GtkxNumericTableSourceClass *klass) {
    klass->read = read_table;
    klass->fill = fill_table;
    klass->read_keys = read_keys;
    klass->fill_keys = fill_keys;
}

gsize gtkx_numeric_table_source_slot(gboolean output) {
    return output ? offsetof(GtkxNumericTableSourceClass, fill)
                  : offsetof(GtkxNumericTableSourceClass, read);
}

gsize gtkx_numeric_table_source_key_slot(gboolean output) {
    return output ? offsetof(GtkxNumericTableSourceClass, fill_keys)
                  : offsetof(GtkxNumericTableSourceClass, read_keys);
}

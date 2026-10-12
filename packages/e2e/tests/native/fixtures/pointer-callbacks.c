#include <glib-object.h>

typedef gint (*GtkxIntCallback)(gint);

typedef struct {
    GObject parent_instance;
    GtkxIntCallback callback;
    guint id;
    gboolean invoke_before_set;
} GtkxCallbackObject;

typedef struct {
    GObjectClass parent_class;
} GtkxCallbackObjectClass;

static guint next_id;
static GHashTable *finalized;
static GtkxCallbackObject *held;

G_DEFINE_TYPE(GtkxCallbackObject, gtkx_callback_object, G_TYPE_OBJECT)

static void gtkx_callback_object_set_property(GObject *object, guint property_id,
                                             const GValue *value, GParamSpec *pspec)
{
    GtkxCallbackObject *self = (GtkxCallbackObject *)object;

    if (property_id == 1) {
        if (self->invoke_before_set && self->callback != NULL) {
            self->invoke_before_set = FALSE;
            self->callback(0);
        }
        self->callback = (GtkxIntCallback)g_value_get_pointer(value);
    } else {
        G_OBJECT_WARN_INVALID_PROPERTY_ID(object, property_id, pspec);
    }
}

static void gtkx_callback_object_get_property(GObject *object, guint property_id,
                                             GValue *value, GParamSpec *pspec)
{
    GtkxCallbackObject *self = (GtkxCallbackObject *)object;

    if (property_id == 1) {
        g_value_set_pointer(value, self->callback);
    } else {
        G_OBJECT_WARN_INVALID_PROPERTY_ID(object, property_id, pspec);
    }
}

static void gtkx_callback_object_finalize(GObject *object)
{
    GtkxCallbackObject *self = (GtkxCallbackObject *)object;

    g_hash_table_add(finalized, GUINT_TO_POINTER(self->id));
    G_OBJECT_CLASS(gtkx_callback_object_parent_class)->finalize(object);
}

static void gtkx_callback_object_class_init(GtkxCallbackObjectClass *klass)
{
    GObjectClass *object_class = G_OBJECT_CLASS(klass);

    finalized = g_hash_table_new(g_direct_hash, g_direct_equal);
    object_class->set_property = gtkx_callback_object_set_property;
    object_class->get_property = gtkx_callback_object_get_property;
    object_class->finalize = gtkx_callback_object_finalize;
    g_object_class_install_property(object_class, 1,
        g_param_spec_pointer("callback", "Callback", "Stored integer callback",
                             G_PARAM_READWRITE | G_PARAM_CONSTRUCT));
}

static void gtkx_callback_object_init(GtkxCallbackObject *self)
{
    self->callback = NULL;
    self->id = ++next_id;
}

guint gtkx_callback_object_id(GtkxCallbackObject *self)
{
    return self->id;
}

gboolean gtkx_callback_object_was_finalized(guint id)
{
    return g_hash_table_contains(finalized, GUINT_TO_POINTER(id));
}

gint gtkx_callback_object_invoke(GtkxCallbackObject *self, gint value)
{
    return self->callback == NULL ? -1 : self->callback(value);
}

void gtkx_callback_object_invoke_before_next_set(GtkxCallbackObject *self)
{
    self->invoke_before_set = TRUE;
}

void gtkx_callback_object_hold(GtkxCallbackObject *self)
{
    g_set_object(&held, self);
}

void gtkx_callback_object_release(void)
{
    g_clear_object(&held);
}

gint gtkx_callback_object_invoke_held(gint value)
{
    return held == NULL ? -1 : gtkx_callback_object_invoke(held, value);
}

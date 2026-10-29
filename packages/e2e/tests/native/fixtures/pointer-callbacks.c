#include <glib-object.h>

typedef gint (*GtkxIntCallback)(gint);

typedef struct {
    GObject parent_instance;
    GtkxIntCallback callback;
    GtkxIntCallback write_only_callback;
    guint id;
    gboolean invoke_before_set;
    guint fail_next_set;
    gboolean invoke_during_get;
    gboolean invoke_on_every_get;
    gboolean emitting_nested;
    guint nested_return_id;
} GtkxCallbackObject;

typedef struct {
    GObjectClass parent_class;
} GtkxCallbackObjectClass;

static guint next_id;
static GHashTable *finalized;
static GtkxCallbackObject *held;
static guint return_object_signal;
static guint return_full_object_signal;

G_DEFINE_TYPE(GtkxCallbackObject, gtkx_callback_object, G_TYPE_OBJECT)

static void gtkx_callback_object_set_property(GObject *object, guint property_id,
                                             const GValue *value, GParamSpec *pspec)
{
    GtkxCallbackObject *self = (GtkxCallbackObject *)object;

    if (property_id == 1 || property_id == 2) {
        GtkxIntCallback *callback = property_id == 1 ? &self->callback : &self->write_only_callback;
        guint failure = self->fail_next_set;
        self->fail_next_set = 0;
        if (failure == 1) {
            g_critical("fixture callback setter failed before storing");
            return;
        }
        if (self->invoke_before_set && *callback != NULL) {
            self->invoke_before_set = FALSE;
            (*callback)(0);
        }
        *callback = (GtkxIntCallback)g_value_get_pointer(value);
        if (failure == 2) {
            g_critical("fixture callback setter failed after storing");
        }
    } else {
        G_OBJECT_WARN_INVALID_PROPERTY_ID(object, property_id, pspec);
    }
}

static void gtkx_callback_object_get_property(GObject *object, guint property_id,
                                             GValue *value, GParamSpec *pspec)
{
    GtkxCallbackObject *self = (GtkxCallbackObject *)object;

    if (property_id == 1) {
        GtkxIntCallback callback = self->callback;
        if ((self->invoke_during_get || self->invoke_on_every_get) && callback != NULL) {
            self->invoke_during_get = FALSE;
            callback(0);
        }
        g_value_set_pointer(value, callback);
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

static gboolean discard_return_object(GSignalInvocationHint *hint, GValue *accumulated,
                                      const GValue *returned, gpointer data)
{
    (void)hint;
    (void)accumulated;
    (void)returned;
    (void)data;
    return TRUE;
}

static void gtkx_callback_object_class_init(GtkxCallbackObjectClass *klass)
{
    GObjectClass *object_class = G_OBJECT_CLASS(klass);

    finalized = g_hash_table_new(g_direct_hash, g_direct_equal);
    object_class->set_property = gtkx_callback_object_set_property;
    object_class->get_property = gtkx_callback_object_get_property;
    object_class->finalize = gtkx_callback_object_finalize;
    return_object_signal = g_signal_new("return-object-borrowed", G_TYPE_FROM_CLASS(klass),
                                        G_SIGNAL_RUN_LAST, 0, g_signal_accumulator_first_wins,
                                        NULL, NULL, G_TYPE_OBJECT, 0);
    return_full_object_signal = g_signal_new("return-object-full", G_TYPE_FROM_CLASS(klass),
                                             G_SIGNAL_RUN_LAST, 0, g_signal_accumulator_first_wins,
                                             NULL, NULL, G_TYPE_OBJECT, 0);
    g_signal_new("return-object-unregistered", G_TYPE_FROM_CLASS(klass),
                 G_SIGNAL_RUN_LAST, 0, g_signal_accumulator_first_wins,
                 NULL, NULL, G_TYPE_OBJECT, 0);
    g_signal_new("return-object-last", G_TYPE_FROM_CLASS(klass),
                 G_SIGNAL_RUN_LAST, 0, NULL, NULL, NULL, G_TYPE_OBJECT, 0);
    g_signal_new("return-object-discard", G_TYPE_FROM_CLASS(klass),
                 G_SIGNAL_RUN_LAST, 0, discard_return_object, NULL, NULL, G_TYPE_OBJECT, 0);
    g_signal_new("return-object-reentrant", G_TYPE_FROM_CLASS(klass),
                 G_SIGNAL_RUN_LAST, 0, NULL, NULL, NULL, G_TYPE_OBJECT, 0);
    g_object_class_install_property(object_class, 1,
        g_param_spec_pointer("callback", "Callback", "Stored integer callback",
                             G_PARAM_READWRITE | G_PARAM_CONSTRUCT));
    g_object_class_install_property(object_class, 2,
        g_param_spec_pointer("write-only-callback", "Write-only callback", "Stored integer callback",
                             G_PARAM_WRITABLE));
}

static void gtkx_callback_object_init(GtkxCallbackObject *self)
{
    self->callback = NULL;
    self->id = ++next_id;
}

GtkxCallbackObject *gtkx_callback_object_new(GtkxIntCallback callback)
{
    GtkxCallbackObject *self = g_object_new(gtkx_callback_object_get_type(), NULL);
    self->callback = callback;
    return self;
}

GObject *gtkx_callback_object_emit_return_object(GtkxCallbackObject *self, gboolean full)
{
    GObject *result = NULL;
    g_signal_emit(self, full ? return_full_object_signal : return_object_signal, 0, &result);
    return result;
}

static GObject *reemit_return_object(GtkxCallbackObject *self, gpointer data)
{
    (void)data;
    if (!self->emitting_nested) {
        GObject *result = NULL;
        self->emitting_nested = TRUE;
        g_signal_emit_by_name(self, "return-object-reentrant", &result);
        self->emitting_nested = FALSE;
        self->nested_return_id = result == NULL ? 0 : ((GtkxCallbackObject *)result)->id;
    }
    return NULL;
}

gulong gtkx_callback_object_connect_reentrant(GtkxCallbackObject *self)
{
    return g_signal_connect(self, "return-object-reentrant", G_CALLBACK(reemit_return_object), NULL);
}

guint gtkx_callback_object_nested_return_id(GtkxCallbackObject *self)
{
    return self->nested_return_id;
}

GObject *gtkx_callback_object_invoke_closure(GClosure *closure, GObject *source, gboolean boxed)
{
    GValue argument = G_VALUE_INIT;
    GValue result = G_VALUE_INIT;
    GObject *object;

    if (boxed) {
        g_value_init(&argument, G_TYPE_BYTES);
        g_value_take_boxed(&argument, g_bytes_new_static("test", 4));
    } else {
        g_value_init(&argument, G_TYPE_OBJECT);
        g_value_set_object(&argument, source);
    }
    g_value_init(&result, G_TYPE_OBJECT);
    g_closure_invoke(closure, &result, 1, &argument, GINT_TO_POINTER(1));
    object = g_value_dup_object(&result);
    g_value_unset(&argument);
    g_value_unset(&result);
    return object;
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

gint gtkx_callback_object_invoke_write_only(GtkxCallbackObject *self, gint value)
{
    return self->write_only_callback == NULL ? -1 : self->write_only_callback(value);
}

void gtkx_callback_object_invoke_during_next_get(GtkxCallbackObject *self)
{
    self->invoke_during_get = TRUE;
}

void gtkx_callback_object_invoke_on_every_get(GtkxCallbackObject *self)
{
    self->invoke_on_every_get = TRUE;
}

void gtkx_callback_object_invoke_before_next_set(GtkxCallbackObject *self)
{
    self->invoke_before_set = TRUE;
}

void gtkx_callback_object_fail_next_set(GtkxCallbackObject *self, gboolean after_store)
{
    self->fail_next_set = after_store ? 2 : 1;
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

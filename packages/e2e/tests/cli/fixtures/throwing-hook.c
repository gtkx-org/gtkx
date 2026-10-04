#include <glib-object.h>

typedef gboolean (*ThrowingHookHookFunc)(const gchar *text, gpointer data, GError **error);
typedef gboolean (*ThrowingHookPlainFunc)(const gchar *text, gpointer data);

typedef struct {
    gpointer data;
    GDestroyNotify destroy;
} CallbackData;

typedef struct {
    GObject parent_instance;
    ThrowingHookHookFunc hook;
    CallbackData hook_data;
    ThrowingHookPlainFunc plain;
    CallbackData plain_data;
} ThrowingHookRunner;

typedef GObjectClass ThrowingHookRunnerClass;

G_DEFINE_TYPE(ThrowingHookRunner, throwing_hook_runner, G_TYPE_OBJECT)

static void release_callback(CallbackData *slot) {
    gpointer data = slot->data;
    GDestroyNotify destroy = slot->destroy;
    slot->data = NULL;
    slot->destroy = NULL;
    if (destroy != NULL) destroy(data);
}

void throwing_hook_runner_clear_hooks(ThrowingHookRunner *self) {
    self->hook = NULL;
    self->plain = NULL;
    release_callback(&self->hook_data);
    release_callback(&self->plain_data);
}

static void throwing_hook_runner_finalize(GObject *object) {
    throwing_hook_runner_clear_hooks((ThrowingHookRunner *)object);
    G_OBJECT_CLASS(throwing_hook_runner_parent_class)->finalize(object);
}

static void throwing_hook_runner_class_init(ThrowingHookRunnerClass *klass) {
    G_OBJECT_CLASS(klass)->finalize = throwing_hook_runner_finalize;
}

static void throwing_hook_runner_init(ThrowingHookRunner *self) {
    (void)self;
}

void throwing_hook_runner_set_hook(ThrowingHookRunner *self, ThrowingHookHookFunc hook,
                                  gpointer data, GDestroyNotify destroy) {
    release_callback(&self->hook_data);
    self->hook = hook;
    self->hook_data = (CallbackData){data, destroy};
}

void throwing_hook_runner_set_plain(ThrowingHookRunner *self, ThrowingHookPlainFunc hook,
                                   gpointer data, GDestroyNotify destroy) {
    release_callback(&self->plain_data);
    self->plain = hook;
    self->plain_data = (CallbackData){data, destroy};
}

gboolean throwing_hook_runner_run_hook(ThrowingHookRunner *self, const gchar *text, GError **error) {
    return self->hook(text, self->hook_data.data, error);
}

gint throwing_hook_runner_try_hook(ThrowingHookRunner *self, const gchar *text) {
    GError *error = NULL;
    gboolean accepted = self->hook(text, self->hook_data.data, &error);
    if (error != NULL) {
        g_error_free(error);
        return 2;
    }
    return accepted ? 0 : 1;
}

gboolean throwing_hook_runner_run_plain(ThrowingHookRunner *self, const gchar *text) {
    return self->plain(text, self->plain_data.data);
}

#include <glib-object.h>
#include <stddef.h>

typedef struct {
    GObject parent_instance;
    gint value;
} GtkxWorkerObject;

typedef struct {
    GObjectClass parent_class;
} GtkxWorkerObjectClass;

G_DEFINE_TYPE(GtkxWorkerObject, gtkx_worker_object, G_TYPE_OBJECT)

static GWeakRef target;
static GMutex mutex;
static GCond condition;
static GThread *worker;
static gboolean acquired;
static gboolean released;
static gint finalized;

static void gtkx_worker_object_init(GtkxWorkerObject *object) {
    object->value = 42;
}

static void gtkx_worker_object_class_init(GtkxWorkerObjectClass *klass) {
    (void)klass;
}

guint gtkx_worker_object_value_offset(void) {
    return offsetof(GtkxWorkerObject, value);
}

static void mark_finalized(gpointer data) {
    (void)data;
    g_atomic_int_set(&finalized, 1);
}

void gtkx_worker_prepare(GObject *object) {
    g_atomic_int_set(&finalized, 0);
    acquired = FALSE;
    released = FALSE;
    g_weak_ref_init(&target, object);
    g_object_set_qdata_full(object, g_quark_from_static_string("gtkx-worker-finalized"),
                            GINT_TO_POINTER(1), mark_finalized);
}

static gpointer hold_target(gpointer data) {
    (void)data;
    GObject *object = g_weak_ref_get(&target);

    g_mutex_lock(&mutex);
    acquired = TRUE;
    g_cond_signal(&condition);

    while (!released) {
        g_cond_wait(&condition, &mutex);
    }

    g_mutex_unlock(&mutex);
    g_object_unref(object);
    return NULL;
}

void gtkx_worker_start(void) {
    g_mutex_lock(&mutex);
    worker = g_thread_new("gtkx-object-owner", hold_target, NULL);

    while (!acquired) {
        g_cond_wait(&condition, &mutex);
    }

    g_mutex_unlock(&mutex);
}

gint gtkx_worker_release(gpointer argument) {
    (void)argument;
    g_mutex_lock(&mutex);
    released = TRUE;
    g_cond_signal(&condition);
    g_mutex_unlock(&mutex);
    g_thread_join(worker);
    worker = NULL;
    g_weak_ref_clear(&target);
    return g_atomic_int_get(&finalized);
}

void gtkx_worker_cancel(void) {
    if (worker != NULL) {
        gtkx_worker_release(NULL);
    }
}

gint gtkx_worker_is_finalized(void) {
    return g_atomic_int_get(&finalized);
}

gint gtkx_worker_release_nested(gpointer argument, void (*callback)(void)) {
    (void)argument;
    callback();
    return g_atomic_int_get(&finalized);
}

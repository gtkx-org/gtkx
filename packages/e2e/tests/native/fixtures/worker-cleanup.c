#include <glib-object.h>
#include <stddef.h>

typedef struct {
    GObject parent_instance;
    GThread *owner;
    guint kind;
} GtkxWorkerCleanupObject;

typedef struct {
    GObjectClass parent_class;
} GtkxWorkerCleanupObjectClass;

G_DEFINE_TYPE(GtkxWorkerCleanupObject, gtkx_worker_cleanup_object, G_TYPE_OBJECT)

static gint disposed[4];
static gint finalized[4];
static gint wrong_thread;
static gint js_entries;

static void gtkx_worker_cleanup_object_dispose(GObject *object) {
    GtkxWorkerCleanupObject *self = (GtkxWorkerCleanupObject *)object;
    if (self->owner != g_thread_self()) {
        g_atomic_int_inc(&wrong_thread);
    }
    g_atomic_int_inc(&disposed[self->kind]);
    G_OBJECT_CLASS(gtkx_worker_cleanup_object_parent_class)->dispose(object);
}

static void gtkx_worker_cleanup_object_finalize(GObject *object) {
    GtkxWorkerCleanupObject *self = (GtkxWorkerCleanupObject *)object;
    if (self->owner != g_thread_self()) {
        g_atomic_int_inc(&wrong_thread);
    }
    g_atomic_int_inc(&finalized[self->kind]);
    g_thread_unref(self->owner);
    G_OBJECT_CLASS(gtkx_worker_cleanup_object_parent_class)->finalize(object);
}

static void gtkx_worker_cleanup_object_class_init(GtkxWorkerCleanupObjectClass *klass) {
    GObjectClass *object_class = G_OBJECT_CLASS(klass);
    object_class->dispose = gtkx_worker_cleanup_object_dispose;
    object_class->finalize = gtkx_worker_cleanup_object_finalize;
}

static void gtkx_worker_cleanup_object_init(GtkxWorkerCleanupObject *object) {
    object->owner = g_thread_ref(g_thread_self());
}

GObject *gtkx_worker_cleanup_new(guint kind) {
    GtkxWorkerCleanupObject *object = g_object_new(gtkx_worker_cleanup_object_get_type(), NULL);
    object->kind = kind;
    return G_OBJECT(object);
}

void gtkx_worker_cleanup_set_kind(GObject *object, guint kind) {
    ((GtkxWorkerCleanupObject *)object)->kind = kind;
}

guint gtkx_worker_cleanup_dispose_offset(void) {
    return offsetof(GObjectClass, dispose);
}

guint gtkx_worker_cleanup_finalize_offset(void) {
    return offsetof(GObjectClass, finalize);
}

gint gtkx_worker_cleanup_disposed(guint kind) {
    return g_atomic_int_get(&disposed[kind]);
}

gint gtkx_worker_cleanup_finalized(guint kind) {
    return g_atomic_int_get(&finalized[kind]);
}

gint gtkx_worker_cleanup_wrong_thread(void) {
    return g_atomic_int_get(&wrong_thread);
}

void gtkx_worker_cleanup_note_js_entry(void) {
    g_atomic_int_inc(&js_entries);
}

gint gtkx_worker_cleanup_js_entries(void) {
    return g_atomic_int_get(&js_entries);
}

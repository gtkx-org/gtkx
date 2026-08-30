#include "gtkx-lifecycle.h"

struct _GtkxLifecycleObject {
  GObject parent_instance;
  gchar *value;
};

struct _GtkxLifecycleDeepBoxed {
  gchar *value;
};

struct _GtkxLifecycleRefBoxed {
  guint ref_count;
  gchar *value;
};

typedef struct {
  GtkxLifecycleCallback callback;
  gpointer user_data;
  GDestroyNotify destroy_notify;
} GtkxLifecyclePendingCallback;

static volatile gint objects_created;
static volatile gint objects_disposed;
static volatile gint objects_finalized;
static volatile gint objects_weak_notified;
static volatile gint watched_objects;
static volatile gint watched_weak_notified;
static volatile gint watched_finalized;
static volatile gint watched_active;
static volatile gint deep_created;
static volatile gint deep_copied;
static volatile gint deep_freed;
static volatile gint deep_duplicate_frees;
static volatile gint ref_created;
static volatile gint ref_acquired;
static volatile gint ref_released;
static volatile gint ref_finalized;
static volatile gint ref_duplicate_releases;
static volatile gint callbacks_registered;
static volatile gint callbacks_invoked;
static volatile gint callbacks_destroyed;
static GMutex storage_mutex;
static GHashTable *deep_live;
static GHashTable *ref_live;
static GPtrArray *pending_callbacks;

G_DEFINE_TYPE(GtkxLifecycleObject, gtkx_lifecycle_object, G_TYPE_OBJECT)
G_DEFINE_BOXED_TYPE(GtkxLifecycleDeepBoxed,
                    gtkx_lifecycle_deep_boxed,
                    gtkx_lifecycle_deep_boxed_copy,
                    gtkx_lifecycle_deep_boxed_free)
G_DEFINE_BOXED_TYPE(GtkxLifecycleRefBoxed,
                    gtkx_lifecycle_ref_boxed,
                    gtkx_lifecycle_ref_boxed_ref,
                    gtkx_lifecycle_ref_boxed_unref)

static void ensure_storage(void) {
  if (deep_live == NULL)
    deep_live = g_hash_table_new(g_direct_hash, g_direct_equal);
  if (ref_live == NULL)
    ref_live = g_hash_table_new(g_direct_hash, g_direct_equal);
}

static void gtkx_lifecycle_object_weak_notify(gpointer data G_GNUC_UNUSED,
                                              GObject *object G_GNUC_UNUSED) {
  g_atomic_int_inc(&objects_weak_notified);
}

static void gtkx_lifecycle_object_dispose(GObject *object) {
  g_atomic_int_inc(&objects_disposed);
  G_OBJECT_CLASS(gtkx_lifecycle_object_parent_class)->dispose(object);
}

static void gtkx_lifecycle_object_finalize(GObject *object) {
  GtkxLifecycleObject *self = GTKX_LIFECYCLE_OBJECT(object);
  g_clear_pointer(&self->value, g_free);
  g_atomic_int_inc(&objects_finalized);
  G_OBJECT_CLASS(gtkx_lifecycle_object_parent_class)->finalize(object);
}

static void gtkx_lifecycle_object_class_init(GtkxLifecycleObjectClass *klass) {
  GObjectClass *object_class = G_OBJECT_CLASS(klass);
  object_class->dispose = gtkx_lifecycle_object_dispose;
  object_class->finalize = gtkx_lifecycle_object_finalize;
}

static void gtkx_lifecycle_object_init(GtkxLifecycleObject *self) {
  g_atomic_int_inc(&objects_created);
  g_object_weak_ref(G_OBJECT(self), gtkx_lifecycle_object_weak_notify, NULL);
}

GtkxLifecycleObject *gtkx_lifecycle_object_new(const gchar *value) {
  GtkxLifecycleObject *self = g_object_new(GTKX_LIFECYCLE_TYPE_OBJECT, NULL);
  self->value = g_strdup(value);
  return self;
}

const gchar *gtkx_lifecycle_object_get_value(GtkxLifecycleObject *self) {
  g_return_val_if_fail(GTKX_LIFECYCLE_IS_OBJECT(self), NULL);
  return self->value;
}

void gtkx_lifecycle_object_set_value(GtkxLifecycleObject *self, const gchar *value) {
  g_return_if_fail(GTKX_LIFECYCLE_IS_OBJECT(self));
  g_free(self->value);
  self->value = g_strdup(value);
}

GtkxLifecycleDeepBoxed *gtkx_lifecycle_deep_boxed_new(const gchar *value) {
  GtkxLifecycleDeepBoxed *self = g_new0(GtkxLifecycleDeepBoxed, 1);
  self->value = g_strdup(value);
  g_mutex_lock(&storage_mutex);
  ensure_storage();
  g_hash_table_add(deep_live, self);
  g_mutex_unlock(&storage_mutex);
  g_atomic_int_inc(&deep_created);
  return self;
}

GtkxLifecycleDeepBoxed *gtkx_lifecycle_deep_boxed_copy(GtkxLifecycleDeepBoxed *self) {
  g_return_val_if_fail(self != NULL, NULL);
  GtkxLifecycleDeepBoxed *copy = g_new0(GtkxLifecycleDeepBoxed, 1);
  copy->value = g_strdup(self->value);
  g_mutex_lock(&storage_mutex);
  ensure_storage();
  g_hash_table_add(deep_live, copy);
  g_mutex_unlock(&storage_mutex);
  g_atomic_int_inc(&deep_copied);
  return copy;
}

void gtkx_lifecycle_deep_boxed_free(GtkxLifecycleDeepBoxed *self) {
  if (self == NULL)
    return;
  g_mutex_lock(&storage_mutex);
  ensure_storage();
  if (!g_hash_table_remove(deep_live, self)) {
    g_mutex_unlock(&storage_mutex);
    g_atomic_int_inc(&deep_duplicate_frees);
    return;
  }
  g_clear_pointer(&self->value, g_free);
  g_mutex_unlock(&storage_mutex);
  g_free(self);
  g_atomic_int_inc(&deep_freed);
}

const gchar *gtkx_lifecycle_deep_boxed_get_value(GtkxLifecycleDeepBoxed *self) {
  g_return_val_if_fail(self != NULL, NULL);
  return self->value;
}

void gtkx_lifecycle_deep_boxed_set_value(GtkxLifecycleDeepBoxed *self, const gchar *value) {
  g_return_if_fail(self != NULL);
  g_free(self->value);
  self->value = g_strdup(value);
}

GtkxLifecycleRefBoxed *gtkx_lifecycle_ref_boxed_new(const gchar *value) {
  GtkxLifecycleRefBoxed *self = g_new0(GtkxLifecycleRefBoxed, 1);
  self->ref_count = 1;
  self->value = g_strdup(value);
  g_mutex_lock(&storage_mutex);
  ensure_storage();
  g_hash_table_add(ref_live, self);
  g_mutex_unlock(&storage_mutex);
  g_atomic_int_inc(&ref_created);
  return self;
}

GtkxLifecycleRefBoxed *gtkx_lifecycle_ref_boxed_ref(GtkxLifecycleRefBoxed *self) {
  g_return_val_if_fail(self != NULL, NULL);
  g_mutex_lock(&storage_mutex);
  ensure_storage();
  if (!g_hash_table_contains(ref_live, self)) {
    g_mutex_unlock(&storage_mutex);
    return NULL;
  }
  self->ref_count++;
  g_mutex_unlock(&storage_mutex);
  g_atomic_int_inc(&ref_acquired);
  return self;
}

void gtkx_lifecycle_ref_boxed_unref(GtkxLifecycleRefBoxed *self) {
  if (self == NULL)
    return;
  g_mutex_lock(&storage_mutex);
  ensure_storage();
  if (!g_hash_table_contains(ref_live, self) || self->ref_count == 0) {
    g_mutex_unlock(&storage_mutex);
    g_atomic_int_inc(&ref_duplicate_releases);
    return;
  }
  self->ref_count--;
  g_atomic_int_inc(&ref_released);
  if (self->ref_count == 0) {
    g_hash_table_remove(ref_live, self);
    g_clear_pointer(&self->value, g_free);
    g_atomic_int_inc(&ref_finalized);
  }
  g_mutex_unlock(&storage_mutex);
  if (self->ref_count == 0)
    g_free(self);
}

guint gtkx_lifecycle_ref_boxed_get_ref_count(GtkxLifecycleRefBoxed *self) {
  g_return_val_if_fail(self != NULL, 0);
  g_mutex_lock(&storage_mutex);
  ensure_storage();
  guint result = g_hash_table_contains(ref_live, self) ? self->ref_count : 0;
  g_mutex_unlock(&storage_mutex);
  return result;
}

const gchar *gtkx_lifecycle_ref_boxed_get_value(GtkxLifecycleRefBoxed *self) {
  g_return_val_if_fail(self != NULL, NULL);
  return self->value;
}

void gtkx_lifecycle_callback_register(GtkxLifecycleCallback callback,
                                      gpointer user_data,
                                      GDestroyNotify destroy_notify) {
  g_return_if_fail(callback != NULL);
  if (pending_callbacks == NULL)
    pending_callbacks = g_ptr_array_new_with_free_func(g_free);
  GtkxLifecyclePendingCallback *pending = g_new0(GtkxLifecyclePendingCallback, 1);
  pending->callback = callback;
  pending->user_data = user_data;
  pending->destroy_notify = destroy_notify;
  g_ptr_array_add(pending_callbacks, pending);
  g_atomic_int_inc(&callbacks_registered);
}

void gtkx_lifecycle_callbacks_invoke(void) {
  if (pending_callbacks == NULL)
    return;
  for (guint i = 0; i < pending_callbacks->len; i++) {
    GtkxLifecyclePendingCallback *pending = g_ptr_array_index(pending_callbacks, i);
    pending->callback(pending->user_data);
    g_atomic_int_inc(&callbacks_invoked);
  }
}

void gtkx_lifecycle_callbacks_release(void) {
  if (pending_callbacks == NULL)
    return;
  GPtrArray *released = pending_callbacks;
  pending_callbacks = NULL;
  for (guint i = 0; i < released->len; i++) {
    GtkxLifecyclePendingCallback *pending = g_ptr_array_index(released, i);
    if (pending->destroy_notify != NULL) {
      pending->destroy_notify(pending->user_data);
      g_atomic_int_inc(&callbacks_destroyed);
    }
  }
  g_ptr_array_unref(released);
}

guint gtkx_lifecycle_callbacks_pending(void) {
  return pending_callbacks == NULL ? 0 : pending_callbacks->len;
}

static GQuark gtkx_lifecycle_watch_quark(void) {
  return g_quark_from_static_string("gtkx-lifecycle-watch");
}

static void gtkx_lifecycle_watch_weak_notify(gpointer data G_GNUC_UNUSED,
                                             GObject *object G_GNUC_UNUSED) {
  g_atomic_int_inc(&watched_weak_notified);
}

static void gtkx_lifecycle_watch_finalize(gpointer data G_GNUC_UNUSED) {
  g_atomic_int_inc(&watched_finalized);
  g_atomic_int_add(&watched_active, -1);
}

gboolean gtkx_lifecycle_watch_object(GObject *object) {
  g_return_val_if_fail(G_IS_OBJECT(object), FALSE);
  GQuark quark = gtkx_lifecycle_watch_quark();
  if (g_object_get_qdata(object, quark) != NULL)
    return FALSE;
  g_object_weak_ref(object, gtkx_lifecycle_watch_weak_notify, NULL);
  g_object_set_qdata_full(object,
                          quark,
                          GINT_TO_POINTER(1),
                          gtkx_lifecycle_watch_finalize);
  g_atomic_int_inc(&watched_objects);
  g_atomic_int_inc(&watched_active);
  return TRUE;
}

guint gtkx_lifecycle_get_object_ref_count(GObject *object) {
  g_return_val_if_fail(G_IS_OBJECT(object), 0);
  return object->ref_count;
}

void gtkx_lifecycle_reset(void) {
  gtkx_lifecycle_callbacks_release();
  g_atomic_int_set(&objects_created, 0);
  g_atomic_int_set(&objects_disposed, 0);
  g_atomic_int_set(&objects_finalized, 0);
  g_atomic_int_set(&objects_weak_notified, 0);
  g_atomic_int_set(&watched_objects, 0);
  g_atomic_int_set(&watched_weak_notified, 0);
  g_atomic_int_set(&watched_finalized, 0);
  g_atomic_int_set(&deep_created, 0);
  g_atomic_int_set(&deep_copied, 0);
  g_atomic_int_set(&deep_freed, 0);
  g_atomic_int_set(&deep_duplicate_frees, 0);
  g_atomic_int_set(&ref_created, 0);
  g_atomic_int_set(&ref_acquired, 0);
  g_atomic_int_set(&ref_released, 0);
  g_atomic_int_set(&ref_finalized, 0);
  g_atomic_int_set(&ref_duplicate_releases, 0);
  g_atomic_int_set(&callbacks_registered, 0);
  g_atomic_int_set(&callbacks_invoked, 0);
  g_atomic_int_set(&callbacks_destroyed, 0);
}

gchar *gtkx_lifecycle_snapshot(void) {
  g_mutex_lock(&storage_mutex);
  ensure_storage();
  guint deep_live_count = g_hash_table_size(deep_live);
  guint ref_live_count = g_hash_table_size(ref_live);
  g_mutex_unlock(&storage_mutex);
  return g_strdup_printf(
      "{\"objectsCreated\":%d,\"objectsDisposed\":%d,\"objectsFinalized\":%d,"
      "\"objectsWeakNotified\":%d,\"watchedObjects\":%d,\"watchedWeakNotified\":%d,"
      "\"watchedFinalized\":%d,\"watchedActive\":%d,\"deepCreated\":%d,"
      "\"deepCopied\":%d,\"deepFreed\":%d,\"deepDuplicateFrees\":%d,"
      "\"deepLive\":%u,\"refCreated\":%d,\"refAcquired\":%d,"
      "\"refReleased\":%d,\"refFinalized\":%d,\"refDuplicateReleases\":%d,"
      "\"refLive\":%u,\"callbacksRegistered\":%d,\"callbacksInvoked\":%d,"
      "\"callbacksDestroyed\":%d,\"callbacksPending\":%u}",
      g_atomic_int_get(&objects_created),
      g_atomic_int_get(&objects_disposed),
      g_atomic_int_get(&objects_finalized),
      g_atomic_int_get(&objects_weak_notified),
      g_atomic_int_get(&watched_objects),
      g_atomic_int_get(&watched_weak_notified),
      g_atomic_int_get(&watched_finalized),
      g_atomic_int_get(&watched_active),
      g_atomic_int_get(&deep_created),
      g_atomic_int_get(&deep_copied),
      g_atomic_int_get(&deep_freed),
      g_atomic_int_get(&deep_duplicate_frees),
      deep_live_count,
      g_atomic_int_get(&ref_created),
      g_atomic_int_get(&ref_acquired),
      g_atomic_int_get(&ref_released),
      g_atomic_int_get(&ref_finalized),
      g_atomic_int_get(&ref_duplicate_releases),
      ref_live_count,
      g_atomic_int_get(&callbacks_registered),
      g_atomic_int_get(&callbacks_invoked),
      g_atomic_int_get(&callbacks_destroyed),
      gtkx_lifecycle_callbacks_pending());
}

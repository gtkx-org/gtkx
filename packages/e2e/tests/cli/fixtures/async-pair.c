#include <gio/gio.h>

typedef struct { GObject parent; } AsyncPairJob;
typedef struct { GObjectClass parent; } AsyncPairJobClass;
G_DEFINE_TYPE(AsyncPairJob, async_pair_job, G_TYPE_OBJECT)
static void async_pair_job_class_init(AsyncPairJobClass *klass) { (void) klass; }
static void async_pair_job_init(AsyncPairJob *self) { (void) self; }

typedef struct { GObject parent; } AsyncPairClient;
typedef struct { GObjectClass parent; } AsyncPairClientClass;
G_DEFINE_TYPE(AsyncPairClient, async_pair_client, G_TYPE_OBJECT)
static void async_pair_client_class_init(AsyncPairClientClass *klass) { (void) klass; }
static void async_pair_client_init(AsyncPairClient *self) { (void) self; }

typedef struct { GObject parent; } AsyncPairSack;
typedef struct { GObjectClass parent; } AsyncPairSackClass;
G_DEFINE_TYPE(AsyncPairSack, async_pair_sack, G_TYPE_OBJECT)
static void async_pair_sack_class_init(AsyncPairSackClass *klass) { (void) klass; }
static void async_pair_sack_init(AsyncPairSack *self) { (void) self; }

typedef struct { GObject parent; } AsyncPairPool;
typedef struct { GObjectClass parent; } AsyncPairPoolClass;
G_DEFINE_TYPE(AsyncPairPool, async_pair_pool, G_TYPE_OBJECT)
static void async_pair_pool_class_init(AsyncPairPoolClass *klass) { (void) klass; }
static void async_pair_pool_init(AsyncPairPool *self) { (void) self; }

static void complete(GObject *source, GCancellable *cancellable,
                     GAsyncReadyCallback callback, gpointer user_data)
{
    GTask *task = g_task_new(source, cancellable, callback, user_data);
    g_task_return_boolean(task, TRUE);
    g_object_unref(task);
}

static gboolean finish(GObject *source, GAsyncResult *result, GError **error)
{
    return g_task_is_valid(result, source) && g_task_propagate_boolean(G_TASK(result), error);
}

static void complete_client(GCancellable *cancellable, GAsyncReadyCallback callback, gpointer user_data)
{
    AsyncPairClient *client = g_object_new(async_pair_client_get_type(), NULL);
    complete(G_OBJECT(client), cancellable, callback, user_data);
    g_object_unref(client);
}

void async_pair_job_run_async(AsyncPairJob *self, GAsyncReadyCallback callback, gpointer user_data)
{
    complete(G_OBJECT(self), NULL, callback, user_data);
}

gboolean async_pair_job_run_finish(AsyncPairJob *self, GAsyncResult *result,
                                   gchar **tag, gsize *size, GError **error)
{
    if (!finish(G_OBJECT(self), result, error))
        return FALSE;
    *tag = g_strdup("done");
    *size = 3;
    return TRUE;
}

void async_pair_job_probe_async(AsyncPairJob *self, GAsyncReadyCallback callback, gpointer user_data)
{
    complete(G_OBJECT(self), NULL, callback, user_data);
}

gboolean async_pair_job_probe_finish(AsyncPairJob *self, GAsyncResult *result, GError **error)
{
    return finish(G_OBJECT(self), result, error);
}

void async_pair_job_external_async(AsyncPairJob *self, GAsyncReadyCallback callback, gpointer user_data)
{
    (void) self;
    complete_client(NULL, callback, user_data);
}

gboolean async_pair_client_generic_finish(AsyncPairClient *self, GAsyncResult *result)
{
    return finish(G_OBJECT(self), result, NULL);
}

void async_pair_sack_fetch_async(AsyncPairSack *self, GCancellable *cancellable,
                                 GAsyncReadyCallback callback, gpointer user_data)
{
    complete(G_OBJECT(self), cancellable, callback, user_data);
}

void async_pair_sack_refresh_async(AsyncPairSack *self, GCancellable *cancellable,
                                   GAsyncReadyCallback callback, gpointer user_data)
{
    complete(G_OBJECT(self), cancellable, callback, user_data);
}

gboolean async_pair_sack_merge_generic_finish(AsyncPairSack *self, GAsyncResult *result, GError **error)
{
    return finish(G_OBJECT(self), result, error);
}

void async_pair_pool_drain_async(AsyncPairPool *self, GCancellable *cancellable,
                                 GAsyncReadyCallback callback, gpointer user_data)
{
    (void) self;
    complete_client(cancellable, callback, user_data);
}

gboolean async_pair_pool_flush_generic_finish(AsyncPairPool *self, GAsyncResult *result, GError **error)
{
    return finish(G_OBJECT(self), result, error);
}

gboolean async_pair_pool_merge_generic_finish(AsyncPairPool *self, GAsyncResult *result, GError **error)
{
    return finish(G_OBJECT(self), result, error);
}

void async_pair_query_async(gboolean should_succeed, GAsyncReadyCallback callback, gpointer user_data)
{
    GTask *task = g_task_new(NULL, NULL, callback, user_data);
    if (should_succeed)
        g_task_return_int(task, 42);
    else
        g_task_return_new_error(task, G_IO_ERROR, G_IO_ERROR_FAILED, "Requested failure");
    g_object_unref(task);
}

gint async_pair_query_finish(GAsyncResult *result, GError **error)
{
    return (gint) g_task_propagate_int(G_TASK(result), error);
}

void async_pair_job_create_async(gboolean should_succeed, GAsyncReadyCallback callback, gpointer user_data)
{
    GTask *task = g_task_new(NULL, NULL, callback, user_data);
    if (should_succeed)
        g_task_return_pointer(task, g_object_new(async_pair_job_get_type(), NULL), g_object_unref);
    else
        g_task_return_new_error(task, G_IO_ERROR, G_IO_ERROR_FAILED, "Requested failure");
    g_object_unref(task);
}

AsyncPairJob *async_pair_job_create_finish(GAsyncResult *result, GError **error)
{
    return g_task_propagate_pointer(G_TASK(result), error);
}

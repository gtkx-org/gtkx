#include <stddef.h>

typedef int (*GtkxUserDataCallback)(void *data);
typedef void (*GtkxCompletionCallback)(void *source, void *result, void *data);
typedef void (*GtkxDestroyNotify)(void *data);
typedef void (*GtkxScalarCallback)(float *value);

static GtkxCompletionCallback pending_completion;
static void *pending_data;
static GtkxDestroyNotify pending_destroy;
static void *pending_side_data;

void gtkx_callback_with_completion(GtkxUserDataCallback callback,
                                   void *data,
                                   GtkxDestroyNotify destroy,
                                   GtkxCompletionCallback completion,
                                   void *completion_data) {
    callback(data);
    pending_completion = completion;
    pending_data = completion_data;
    pending_destroy = destroy;
    pending_side_data = data;
}

int gtkx_callback_complete(void) {
    GtkxCompletionCallback completion = pending_completion;
    void *data = pending_data;
    GtkxDestroyNotify destroy = pending_destroy;
    void *side_data = pending_side_data;
    pending_completion = NULL;
    pending_data = NULL;
    pending_destroy = NULL;
    pending_side_data = NULL;
    if (completion == NULL) {
        return 0;
    }
    completion(NULL, NULL, data);
    if (destroy != NULL) {
        destroy(side_data);
    }
    return 1;
}

int gtkx_callback_user_data(GtkxUserDataCallback callback, void *data) {
    return callback(data);
}

void gtkx_callback_scalar_output(GtkxScalarCallback callback, float *value) {
    callback(value);
}

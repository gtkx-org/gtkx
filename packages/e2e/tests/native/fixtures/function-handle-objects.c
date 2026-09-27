#include <stddef.h>

static void (*completion)(void *);
static void *completion_data;

void gtkx_object_buffer_hold(void *buffer, void (*callback)(void *), void *data) {
    (void)buffer;
    completion = callback;
    completion_data = data;
}

void gtkx_object_buffer_complete(void) {
    void (*callback)(void *) = completion;
    void *data = completion_data;
    completion = NULL;
    completion_data = NULL;
    callback(data);
}

int gtkx_object_buffer_equal(const void *left, const void *right) {
    return left == right;
}

#include <stdlib.h>

typedef void (*GtkxFunction)(void);
typedef void (*GtkxDestroy)(void *);

typedef struct {
    GtkxFunction function;
    void *data;
    GtkxDestroy destroy;
    unsigned int references;
} GtkxFunctionHolder;

void *gtkx_function_holder_ref(const void *pointer) {
    GtkxFunctionHolder *holder = (GtkxFunctionHolder *)pointer;
    holder->references++;
    return holder;
}

void gtkx_function_holder_unref(void *pointer) {
    GtkxFunctionHolder *holder = pointer;
    if (--holder->references == 0) {
        holder->destroy(holder->data);
        free(holder);
    }
}

GtkxFunctionHolder *gtkx_function_holder_new(GtkxFunction function, void *data, GtkxDestroy destroy) {
    GtkxFunctionHolder *holder = calloc(1, sizeof(GtkxFunctionHolder));
    if (holder == NULL) abort();
    holder->function = function;
    holder->data = data;
    holder->destroy = destroy;
    holder->references = 1;
    return holder;
}

int gtkx_function_pointer_equal(const void *left, const void *right) {
    return left == right;
}

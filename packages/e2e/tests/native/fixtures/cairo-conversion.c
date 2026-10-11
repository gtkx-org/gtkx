#include <cairo/cairo.h>
#include <dlfcn.h>
#include <stdlib.h>

static void *library;
static int active[3];
static int failure;

static void *operation(const char *name) {
    if (library == NULL) {
        library = dlopen("libcairo.so.2", RTLD_NOW | RTLD_LOCAL);
    }
    void *result = dlsym(library, name);
    if (result == NULL) {
        abort();
    }
    return result;
}

void gtkx_cairo_set_failure(int status) {
    failure = status;
}

int gtkx_cairo_active_owners(int kind) {
    return active[kind];
}

cairo_surface_t *cairo_image_surface_create(cairo_format_t format, int width, int height) {
    cairo_surface_t *(*create)(cairo_format_t, int, int) = operation("cairo_image_surface_create");
    cairo_surface_t *result = create(format, width, height);
    if (result != NULL) {
        active[0]++;
    }
    return result;
}

void cairo_surface_destroy(cairo_surface_t *surface) {
    void (*destroy)(cairo_surface_t *) = operation("cairo_surface_destroy");
    active[0]--;
    destroy(surface);
}

cairo_t *cairo_create(cairo_surface_t *surface) {
    cairo_t *(*create)(cairo_surface_t *) = operation("cairo_create");
    cairo_t *result = create(surface);
    if (result != NULL) {
        active[1]++;
    }
    return result;
}

void cairo_destroy(cairo_t *context) {
    void (*destroy)(cairo_t *) = operation("cairo_destroy");
    active[1]--;
    destroy(context);
}

void cairo_append_path(cairo_t *context, const cairo_path_t *path) {
    void (*append)(cairo_t *, const cairo_path_t *) = operation("cairo_append_path");
    append(context, path);
}

cairo_status_t cairo_status(cairo_t *context) {
    cairo_status_t (*status)(cairo_t *) = operation("cairo_status");
    return failure == 1 ? CAIRO_STATUS_NO_MEMORY : status(context);
}

cairo_path_t *cairo_copy_path(cairo_t *context) {
    cairo_path_t *(*copy)(cairo_t *) = operation("cairo_copy_path");
    cairo_path_t *result = copy(context);
    if (result != NULL) {
        active[2]++;
        if (failure == 2) {
            result->status = CAIRO_STATUS_NO_MEMORY;
        }
    }
    return result;
}

void cairo_path_destroy(cairo_path_t *path) {
    void (*destroy)(cairo_path_t *) = operation("cairo_path_destroy");
    active[2]--;
    destroy(path);
}

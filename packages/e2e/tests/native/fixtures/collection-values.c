#include <glib.h>
#include <stddef.h>
#include <stdint.h>

static char *empty_strings[] = {NULL};
static char *strings[] = {"one", "two", NULL};
static uint8_t empty_bytes[] = {0};
static uint8_t bytes[] = {1, 2, 0};

char **gtkx_collection_strings(int state) {
    return state == 0 ? NULL : state == 1 ? empty_strings : strings;
}

uint8_t *gtkx_collection_bytes(int state) {
    return state == 0 ? NULL : state == 1 ? empty_bytes : bytes;
}

void gtkx_collection_out(int state, char ***value) {
    *value = gtkx_collection_strings(state);
}

struct CollectionRecord {
    char **items;
};

struct CollectionRecord *gtkx_collection_record(int state) {
    static struct CollectionRecord records[] = {{NULL}, {empty_strings}, {strings}};
    return &records[state];
}

void gtkx_collection_visit(int state, void (*callback)(char **)) {
    callback(gtkx_collection_strings(state));
}

int gtkx_collection_ref_length(char ***value) {
    return *value == NULL ? -1 : (int)g_strv_length(*value);
}

int gtkx_collection_visit_ref(int state, void (*callback)(char ***)) {
    if (state == 3) {
        callback(NULL);
        return -1;
    }

    char **value = g_strdupv(gtkx_collection_strings(state));
    callback(&value);

    int length = gtkx_collection_ref_length(&value);
    g_strfreev(value);
    return length;
}

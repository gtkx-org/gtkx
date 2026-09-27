#include <stdlib.h>
#include <string.h>

char *gtkx_call_copy_nullable_bytes(const char *value) {
    return value == NULL ? NULL : strdup(value);
}

char **gtkx_call_copy_byte_vector(char *const *values) {
    if (values == NULL) {
        return NULL;
    }

    size_t length = 0;
    while (values[length] != NULL) {
        length++;
    }

    char **result = calloc(length + 1, sizeof(char *));
    if (result == NULL) {
        abort();
    }

    for (size_t index = 0; index < length; index++) {
        result[index] = strdup(values[index]);
        if (result[index] == NULL) {
            abort();
        }
    }

    return result;
}

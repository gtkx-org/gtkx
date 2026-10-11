#include <pthread.h>
#include <stdio.h>
#include <stdlib.h>

extern void g_log_structured_standard(const char *, unsigned int, const char *, const char *, const char *, const char *, ...);

struct producer {
    unsigned int index;
    unsigned int count;
};

static void *produce(void *data) {
    struct producer *producer = data;
    for (unsigned int index = 0; index < producer->count; index++) {
        char message[64];
        snprintf(message, sizeof(message), "%u:%u", producer->index, index);
        g_log_structured_standard("gtkx-threaded-test", 64, __FILE__, "1", "produce", "%s", message);
    }
    return NULL;
}

void gtkx_log_threads(unsigned int count) {
    pthread_t threads[4];
    struct producer producers[4];
    for (unsigned int index = 0; index < 4; index++) {
        producers[index] = (struct producer){.index = index, .count = count};
        if (pthread_create(&threads[index], NULL, produce, &producers[index]) != 0) {
            abort();
        }
    }
    for (unsigned int index = 0; index < 4; index++) {
        pthread_join(threads[index], NULL);
    }
}

void gtkx_log_nested(void (*callback)(void)) {
    g_log_structured_standard("gtkx-nested-test", 8, __FILE__, "1", "nested", "outer critical");
    callback();
}

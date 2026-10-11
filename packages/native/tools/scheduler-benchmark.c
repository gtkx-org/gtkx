/** Isolated GLib/libuv scheduling experiment; never loaded by the runtime. */
#include <glib.h>
#include <glib-unix.h>
#include <node_api.h>
#include <stdint.h>
#include <stdlib.h>
#include <unistd.h>
#include <uv.h>

#define CHECK(call) do { if ((call) != napi_ok) abort(); } while (0)
#define CAPACITY 256

typedef struct {
    uv_poll_t handle;
    int fd;
} Poller;

static void wakeup(uv_timer_t *timer) { (void)timer; }
static void readable(uv_poll_t *poller, int status, int events) {
    (void)poller;
    (void)status;
    (void)events;
}
static gboolean keep_ready(gpointer data) { (void)data; return G_SOURCE_CONTINUE; }
static gboolean keep_fd(gint fd, GIOCondition condition, gpointer data) {
    (void)fd;
    (void)condition;
    (void)data;
    return G_SOURCE_CONTINUE;
}

static napi_value number(napi_env env, double value) {
    napi_value result;
    CHECK(napi_create_double(env, value, &result));
    return result;
}

static void property(napi_env env, napi_value object, const char *key, double value) {
    CHECK(napi_set_named_property(env, object, key, number(env, value)));
}

static int integer_property(napi_env env, napi_value object, const char *key) {
    napi_value value;
    int32_t result;
    CHECK(napi_get_named_property(env, object, key, &value));
    CHECK(napi_get_value_int32(env, value, &result));
    return result;
}

static int uv_events(gushort events) {
    int result = 0;
    if (events & G_IO_IN) result |= UV_READABLE;
    if (events & G_IO_OUT) result |= UV_WRITABLE;
    if (events & (G_IO_HUP | G_IO_ERR)) result |= UV_DISCONNECT;
    if (events & G_IO_PRI) result |= UV_PRIORITIZED;
    return result ? result : UV_DISCONNECT;
}

static napi_value run(napi_env env, napi_callback_info info) {
    size_t argc = 4;
    napi_value args[4];
    CHECK(napi_get_cb_info(env, info, &argc, args, NULL, NULL));
    int32_t iterations, descriptors;
    bool busy;
    CHECK(napi_get_value_int32(env, args[0], &iterations));
    CHECK(napi_get_value_int32(env, args[1], &descriptors));
    CHECK(napi_get_value_bool(env, args[2], &busy));
    if (descriptors < 0 || descriptors > CAPACITY - 8 || iterations < 1) abort();
    napi_valuetype policy_type;
    CHECK(napi_typeof(env, args[3], &policy_type));
    const bool split = policy_type == napi_function;
    napi_value receiver;
    CHECK(napi_get_undefined(env, &receiver));

    GMainContext *context = g_main_context_new();
    if (!g_main_context_acquire(context)) abort();
    GSource *sources[CAPACITY];
    int pipes[CAPACITY][2];
    for (int index = 0; index < descriptors; index++) {
        if (pipe(pipes[index])) abort();
        sources[index] = g_unix_fd_source_new(pipes[index][0], G_IO_IN);
        g_source_set_callback(sources[index], G_SOURCE_FUNC(keep_fd), NULL, NULL);
        g_source_attach(sources[index], context);
    }
    GSource *idle = NULL;
    if (busy) {
        idle = g_idle_source_new();
        g_source_set_callback(idle, keep_ready, NULL, NULL);
        g_source_attach(idle, context);
    }
    uv_loop_t loop;
    uv_timer_t timer;
    if (uv_loop_init(&loop) || uv_timer_init(&loop, &timer)) abort();
    Poller pollers[CAPACITY];
    int n_pollers = 0;
    GPollFD fds[CAPACITY];
    const uint64_t start = uv_hrtime();
    for (int iteration = 0; iteration < iterations; iteration++) {
        const uint64_t dispatch_start = uv_hrtime();
        while (g_main_context_iteration(context, FALSE) && uv_hrtime() - dispatch_start < 4000000) {}
        int priority, timeout;
        const gboolean prepared = g_main_context_prepare(context, &priority);
        const int count = g_main_context_query(context, priority, &timeout, fds, CAPACITY);
        if (count < 0 || count > CAPACITY) abort();
        for (int index = 0; index < count; index++) fds[index].revents = 0;
        const gboolean ready = g_main_context_check(context, priority, fds, count) || prepared;
        int desired_fds[CAPACITY];
        int desired_events[CAPACITY];
        int desired_count = 0;
        int delay = ready ? 0 : timeout;
        napi_handle_scope scope;
        if (split) {
            CHECK(napi_open_handle_scope(env, &scope));
            napi_value snapshot, entries;
            CHECK(napi_create_object(env, &snapshot));
            property(env, snapshot, "timeout", timeout);
            property(env, snapshot, "ready", ready);
            CHECK(napi_create_array_with_length(env, (size_t)count, &entries));
            for (int index = 0; index < count; index++) {
                napi_value entry;
                CHECK(napi_create_object(env, &entry));
                property(env, entry, "fd", fds[index].fd);
                property(env, entry, "events", fds[index].events);
                CHECK(napi_set_element(env, entries, (uint32_t)index, entry));
            }
            CHECK(napi_set_named_property(env, snapshot, "fds", entries));
            napi_value result, desired;
            CHECK(napi_call_function(env, receiver, args[3], 1, &snapshot, &result));
            delay = integer_property(env, result, "delay");
            CHECK(napi_get_named_property(env, result, "fds", &desired));
            uint32_t length;
            CHECK(napi_get_array_length(env, desired, &length));
            if (length > CAPACITY) abort();
            desired_count = (int)length;
            for (int index = 0; index < desired_count; index++) {
                napi_value entry;
                CHECK(napi_get_element(env, desired, (uint32_t)index, &entry));
                desired_fds[index] = integer_property(env, entry, "fd");
                desired_events[index] = integer_property(env, entry, "events");
            }
            CHECK(napi_close_handle_scope(env, scope));
        } else {
            for (int index = 0; index < count; index++) {
                int found = 0;
                while (found < desired_count && desired_fds[found] != fds[index].fd) found++;
                if (found == desired_count) {
                    desired_fds[found] = fds[index].fd;
                    desired_events[found] = 0;
                    desired_count++;
                }
                desired_events[found] |= uv_events(fds[index].events);
            }
        }
        for (int index = 0; index < desired_count; index++) {
            int found = 0;
            while (found < n_pollers && pollers[found].fd != desired_fds[index]) found++;
            if (found == n_pollers) {
                pollers[found].fd = desired_fds[index];
                if (uv_poll_init(&loop, &pollers[found].handle, desired_fds[index])) abort();
                n_pollers++;
            }
            if (uv_poll_start(&pollers[found].handle, desired_events[index], readable)) abort();
        }
        if (delay < 0) uv_timer_stop(&timer);
        else uv_timer_start(&timer, wakeup, (uint64_t)delay, 0);
        uv_run(&loop, UV_RUN_NOWAIT);
    }
    const double elapsed = (double)(uv_hrtime() - start) / (double)iterations / 1000.0;
    for (int index = 0; index < n_pollers; index++) uv_close((uv_handle_t *)&pollers[index].handle, NULL);
    uv_close((uv_handle_t *)&timer, NULL);
    uv_run(&loop, UV_RUN_DEFAULT);
    if (uv_loop_close(&loop)) abort();
    for (int index = 0; index < descriptors; index++) {
        g_source_destroy(sources[index]);
        g_source_unref(sources[index]);
        close(pipes[index][0]);
        close(pipes[index][1]);
    }
    if (idle) {
        g_source_destroy(idle);
        g_source_unref(idle);
    }
    g_main_context_release(context);
    g_main_context_unref(context);
    return number(env, elapsed);
}

NAPI_MODULE_INIT() {
    napi_value function;
    CHECK(napi_create_function(env, "run", NAPI_AUTO_LENGTH, run, NULL, &function));
    CHECK(napi_set_named_property(env, exports, "run", function));
    return exports;
}

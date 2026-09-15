#include <glib-object.h>

typedef struct _HookSlotsStation HookSlotsStation;
typedef struct _HookSlotsStationClass HookSlotsStationClass;
typedef gboolean (*HookSlotsHookFunc)(gint value, gpointer user_data);
typedef HookSlotsHookFunc HookSlotsHookAlias;
typedef HookSlotsHookAlias HookSlotsHookAliasChain;

struct _HookSlotsStation {
    GObject parent_instance;
};

struct _HookSlotsStationClass {
    GObjectClass parent_class;
    void (*bind)(HookSlotsStation *, HookSlotsHookFunc, gpointer);
    void (*watch)(HookSlotsStation *, HookSlotsHookFunc, gpointer, GDestroyNotify);
    void (*defer)(HookSlotsStation *, HookSlotsHookFunc, gint, gpointer);
    HookSlotsHookAliasChain (*get_hook)(HookSlotsStation *);
};

typedef struct {
    gint threshold;
} HookData;

static guint data_destroy_count;
static guint callback_count;
static guint base_call_count;
static guint null_call_count;
static gint last_value;
static gboolean base_result;

GType hook_slots_station_get_type(void);
G_DEFINE_TYPE(HookSlotsStation, hook_slots_station, G_TYPE_OBJECT)

static gboolean hook_callback(gint value, gpointer user_data) {
    HookData *data = user_data;
    callback_count++;
    last_value = value;
    return value > data->threshold;
}

static void hook_destroy(gpointer user_data) {
    data_destroy_count++;
    g_free(user_data);
}

static void station_watch(HookSlotsStation *self, HookSlotsHookFunc hook,
                          gpointer user_data, GDestroyNotify destroy) {
    (void)self;
    base_call_count++;
    if (hook == NULL) {
        null_call_count++;
        base_result = FALSE;
    } else {
        base_result = hook(42, user_data);
    }
    if (destroy != NULL) {
        destroy(user_data);
    }
}

static void hook_slots_station_class_init(HookSlotsStationClass *klass) {
    klass->watch = station_watch;
}

static void hook_slots_station_init(HookSlotsStation *self) {
    (void)self;
}

const gchar *hook_slots_station_get_property(HookSlotsStation *self, const gchar *key) {
    (void)self;
    return key;
}

void hook_slots_station_invoke_watch(HookSlotsStation *self, gboolean has_callback) {
    HookSlotsStationClass *klass = (HookSlotsStationClass *)G_OBJECT_GET_CLASS(self);
    if (!has_callback) {
        klass->watch(self, NULL, NULL, NULL);
        return;
    }
    HookData *data = g_new0(HookData, 1);
    data->threshold = 10;
    klass->watch(self, hook_callback, data, hook_destroy);
}

guint hook_slots_get_data_destroy_count(void) {
    return data_destroy_count;
}

guint hook_slots_get_callback_count(void) {
    return callback_count;
}

guint hook_slots_get_base_call_count(void) {
    return base_call_count;
}

guint hook_slots_get_null_call_count(void) {
    return null_call_count;
}

gint hook_slots_get_last_value(void) {
    return last_value;
}

gboolean hook_slots_get_base_result(void) {
    return base_result;
}

#include <glib-object.h>

typedef gboolean (*CallbackFieldsHook) (gint value);
typedef CallbackFieldsHook CallbackFieldsHookAlias;
typedef CallbackFieldsHookAlias CallbackFieldsHookAliasChain;

typedef struct {
    gint before;
    CallbackFieldsHook direct;
    CallbackFieldsHookAliasChain aliased;
    CallbackFieldsHook inline_hooks[2];
    CallbackFieldsHookAliasChain *hooks;
    guint after;
} CallbackFieldsCapsule;

static CallbackFieldsCapsule *
callback_fields_capsule_copy(CallbackFieldsCapsule *capsule)
{
    return g_memdup2(capsule, sizeof *capsule);
}

static void
callback_fields_capsule_free(CallbackFieldsCapsule *capsule)
{
    g_free(capsule);
}

G_DEFINE_BOXED_TYPE(CallbackFieldsCapsule, callback_fields_capsule,
                   callback_fields_capsule_copy, callback_fields_capsule_free)

CallbackFieldsCapsule *
callback_fields_capsule_new(gint before, guint after)
{
    CallbackFieldsCapsule *capsule = g_new0(CallbackFieldsCapsule, 1);
    capsule->before = before;
    capsule->after = after;
    return capsule;
}

gint
callback_fields_capsule_read_before(CallbackFieldsCapsule *capsule)
{
    return capsule->before;
}

guint
callback_fields_capsule_read_after(CallbackFieldsCapsule *capsule)
{
    return capsule->after;
}

gboolean
callback_fields_invoke(CallbackFieldsHookAliasChain callback, gint value)
{
    return callback == NULL ? FALSE : callback(value);
}

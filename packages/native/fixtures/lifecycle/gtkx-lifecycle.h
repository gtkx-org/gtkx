#pragma once

#include <glib-object.h>

G_BEGIN_DECLS

#define GTKX_LIFECYCLE_TYPE_OBJECT (gtkx_lifecycle_object_get_type())

G_DECLARE_FINAL_TYPE(GtkxLifecycleObject, gtkx_lifecycle_object, GTKX_LIFECYCLE, OBJECT, GObject)

GtkxLifecycleObject *gtkx_lifecycle_object_new(const gchar *value);
const gchar *gtkx_lifecycle_object_get_value(GtkxLifecycleObject *self);
void gtkx_lifecycle_object_set_value(GtkxLifecycleObject *self, const gchar *value);

typedef struct _GtkxLifecycleDeepBoxed GtkxLifecycleDeepBoxed;

#define GTKX_LIFECYCLE_TYPE_DEEP_BOXED (gtkx_lifecycle_deep_boxed_get_type())

GType gtkx_lifecycle_deep_boxed_get_type(void);
GtkxLifecycleDeepBoxed *gtkx_lifecycle_deep_boxed_new(const gchar *value);
GtkxLifecycleDeepBoxed *gtkx_lifecycle_deep_boxed_copy(GtkxLifecycleDeepBoxed *self);
void gtkx_lifecycle_deep_boxed_free(GtkxLifecycleDeepBoxed *self);
const gchar *gtkx_lifecycle_deep_boxed_get_value(GtkxLifecycleDeepBoxed *self);
void gtkx_lifecycle_deep_boxed_set_value(GtkxLifecycleDeepBoxed *self, const gchar *value);

typedef struct _GtkxLifecycleRefBoxed GtkxLifecycleRefBoxed;

#define GTKX_LIFECYCLE_TYPE_REF_BOXED (gtkx_lifecycle_ref_boxed_get_type())

GType gtkx_lifecycle_ref_boxed_get_type(void);
GtkxLifecycleRefBoxed *gtkx_lifecycle_ref_boxed_new(const gchar *value);
GtkxLifecycleRefBoxed *gtkx_lifecycle_ref_boxed_ref(GtkxLifecycleRefBoxed *self);
void gtkx_lifecycle_ref_boxed_unref(GtkxLifecycleRefBoxed *self);
guint gtkx_lifecycle_ref_boxed_get_ref_count(GtkxLifecycleRefBoxed *self);
const gchar *gtkx_lifecycle_ref_boxed_get_value(GtkxLifecycleRefBoxed *self);

typedef void (*GtkxLifecycleCallback)(gpointer user_data);

void gtkx_lifecycle_callback_register(GtkxLifecycleCallback callback,
                                      gpointer user_data,
                                      GDestroyNotify destroy_notify);
void gtkx_lifecycle_callbacks_invoke(void);
void gtkx_lifecycle_callbacks_release(void);
guint gtkx_lifecycle_callbacks_pending(void);

gboolean gtkx_lifecycle_watch_object(GObject *object);
guint gtkx_lifecycle_get_object_ref_count(GObject *object);
void gtkx_lifecycle_reset(void);
gchar *gtkx_lifecycle_snapshot(void);

G_END_DECLS

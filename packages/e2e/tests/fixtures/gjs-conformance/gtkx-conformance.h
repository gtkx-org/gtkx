#ifndef GTKX_CONFORMANCE_H
#define GTKX_CONFORMANCE_H

#include <glib-object.h>

G_BEGIN_DECLS

typedef struct _GtkxConformancePod GtkxConformancePod;
typedef struct _GtkxConformanceLifecyclePod GtkxConformanceLifecyclePod;
typedef struct _GtkxConformanceOpaque GtkxConformanceOpaque;
typedef struct _GtkxConformanceTextPod GtkxConformanceTextPod;
typedef union _GtkxConformanceNumberUnion GtkxConformanceNumberUnion;

/**
 * GtkxConformancePod:
 * @number: an integer value
 * @ratio: a floating-point value
 *
 * A plain, non-GTyped record used by the conformance suite.
 */
struct _GtkxConformancePod {
    gint32 number;
    gdouble ratio;
};

/**
 * GtkxConformanceLifecyclePod: (copy-func gtkx_conformance_lifecycle_pod_copy)
 *   (free-func gtkx_conformance_lifecycle_pod_free)
 * @number: an integer value
 * @ratio: a floating-point value
 * @text: an owned UTF-8 string
 *
 * A plain, non-GTyped record with copy and free functions.
 */
struct _GtkxConformanceLifecyclePod {
    gint32 number;
    gdouble ratio;
    gchar *text;
};

/**
 * GtkxConformanceTextPod:
 * @text: a process-lifetime UTF-8 string
 * @number: an integer value
 *
 * A plain, non-GTyped record containing a pointer and a scalar.
 */
struct _GtkxConformanceTextPod {
    const gchar *text;
    gint32 number;
};

/**
 * GtkxConformanceNumberUnion:
 * @number: a signed integer representation
 * @bits: an unsigned integer representation
 *
 * A simple plain union used by the conformance suite.
 */
union _GtkxConformanceNumberUnion {
    gint32 number;
    guint32 bits;
};

/**
 * GtkxConformanceOpaque:
 *
 * A plain, non-GTyped record whose layout is unavailable.
 */

gint32 gtkx_conformance_scalar_add(gint32 left, gint32 right);

gint32 gtkx_conformance_checksum_pod(const GtkxConformancePod *pod);

const GtkxConformancePod *gtkx_conformance_get_static_pod(void);

void gtkx_conformance_set_static_pod(gint32 number, gdouble ratio);

const GtkxConformanceTextPod *gtkx_conformance_get_static_text_pod(void);

void gtkx_conformance_set_static_text_pod(gint32 text_id, gint32 number);

const GtkxConformanceNumberUnion *gtkx_conformance_get_static_number_union(void);

void gtkx_conformance_set_static_number_union(gint32 number);

void gtkx_conformance_fill_pod_none(gint32 number, gdouble ratio, GtkxConformancePod *pod);

void gtkx_conformance_fill_pod_full(gint32 number, gdouble ratio, GtkxConformancePod *pod);

void gtkx_conformance_replace_pod(GtkxConformancePod **pod);

void gtkx_conformance_replace_pod_full(GtkxConformancePod **pod);

void gtkx_conformance_set_replacement_pod(gint32 number, gdouble ratio);

guint gtkx_conformance_get_full_inout_count(void);

gint32 gtkx_conformance_sum_pod_array_none(
    const GtkxConformancePod *pods,
    gsize length
);

gint32 gtkx_conformance_sum_pod_array_container(
    GtkxConformancePod *pods,
    gsize length
);

gint32 gtkx_conformance_sum_pod_array_full(
    GtkxConformancePod *pods,
    gsize length
);

gint32 gtkx_conformance_sum_pod_garray_none(const GArray *pods);

gint32 gtkx_conformance_sum_pod_garray_container(GArray *pods);

gint32 gtkx_conformance_sum_pod_garray_full(GArray *pods);

void gtkx_conformance_set_array_pods(
    gint32 first_number,
    gdouble first_ratio,
    gint32 second_number,
    gdouble second_ratio
);

GArray *gtkx_conformance_get_borrowed_flat_pods(void);

GArray *gtkx_conformance_create_container_flat_pods(void);

GArray *gtkx_conformance_create_full_flat_pods(void);

GArray *gtkx_conformance_create_empty_opaque_flat(void);

GPtrArray *gtkx_conformance_get_borrowed_pods(void);

GPtrArray *gtkx_conformance_create_container_pods(void);

GPtrArray *gtkx_conformance_create_full_pods(void);

GPtrArray *gtkx_conformance_create_opaque_container(void);

GPtrArray *gtkx_conformance_create_empty_opaque_container(void);

void gtkx_conformance_create_rejected_then_owned(
    GtkxConformanceOpaque **opaque,
    GPtrArray **pods
);

guint gtkx_conformance_get_output_cleanup_count(void);

void gtkx_conformance_fill_opaque(GtkxConformanceOpaque *opaque);

guint gtkx_conformance_get_caller_allocated_opaque_count(void);

const GtkxConformanceOpaque *gtkx_conformance_get_null_opaque(void);

const GtkxConformancePod *gtkx_conformance_get_null_full_pod(void);

GtkxConformanceLifecyclePod *gtkx_conformance_lifecycle_pod_copy(
    const GtkxConformanceLifecyclePod *pod
);

void gtkx_conformance_lifecycle_pod_free(GtkxConformanceLifecyclePod *pod);

void gtkx_conformance_consume_lifecycle_pod(GtkxConformanceLifecyclePod *pod);

void gtkx_conformance_consume_pod(GtkxConformancePod *pod);

const GtkxConformancePod *gtkx_conformance_create_full_pod(void);

gboolean gtkx_conformance_require_nonnegative(gint32 value, gint32 *doubled, GError **error);

G_END_DECLS

#endif

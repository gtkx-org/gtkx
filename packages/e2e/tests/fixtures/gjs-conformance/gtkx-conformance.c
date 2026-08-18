#include "gtkx-conformance.h"

static GtkxConformancePod static_pod;
static GtkxConformanceTextPod static_text_pod;
static GtkxConformanceNumberUnion static_number_union;
static GtkxConformancePod array_pods[2];
static gpointer borrowed_pod_data[] = { &array_pods[0], &array_pods[1] };
static GPtrArray borrowed_pods = { borrowed_pod_data, G_N_ELEMENTS(borrowed_pod_data) };
static guint8 opaque_storage;
static guint output_cleanup_count;

static void
count_output_cleanup(gpointer pointer)
{
    (void) pointer;
    output_cleanup_count++;
}

static gint32
sum_pod_array(const GtkxConformancePod *pods, gsize length)
{
    gint64 total = 0;

    for (gsize index = 0; index < length; index++) {
        total += pods[index].number;
        total += (gint32) (pods[index].ratio * 100.0);
    }

    return (gint32) total;
}

/**
 * gtkx_conformance_scalar_add:
 * @left: the left operand
 * @right: the right operand
 *
 * Returns: the sum
 */
gint32
gtkx_conformance_scalar_add(gint32 left, gint32 right)
{
    return left + right;
}

/**
 * gtkx_conformance_checksum_pod:
 * @pod: (transfer none): the record to inspect
 *
 * Returns: a checksum of the record fields
 */
gint32
gtkx_conformance_checksum_pod(const GtkxConformancePod *pod)
{
    return pod->number + (gint32) (pod->ratio * 100.0);
}

/**
 * gtkx_conformance_get_static_pod:
 *
 * Returns: (transfer none): the current static record
 */
const GtkxConformancePod *
gtkx_conformance_get_static_pod(void)
{
    return &static_pod;
}

/**
 * gtkx_conformance_set_static_pod:
 * @number: the record's new integer value
 * @ratio: the record's new floating-point value
 */
void
gtkx_conformance_set_static_pod(gint32 number, gdouble ratio)
{
    static_pod.number = number;
    static_pod.ratio = ratio;
}

/**
 * gtkx_conformance_get_static_text_pod:
 *
 * Returns: (transfer none): the current static pointer-bearing record
 */
const GtkxConformanceTextPod *
gtkx_conformance_get_static_text_pod(void)
{
    return &static_text_pod;
}

/**
 * gtkx_conformance_set_static_text_pod:
 * @text_id: the process-lifetime string literal to select
 * @number: the record's new integer value
 */
void
gtkx_conformance_set_static_text_pod(gint32 text_id, gint32 number)
{
    switch (text_id) {
        case 0:
            static_text_pod.text = "café 日本語";
            break;
        case 1:
            static_text_pod.text = "changed";
            break;
        default:
            static_text_pod.text = "";
            break;
    }

    static_text_pod.number = number;
}

/**
 * gtkx_conformance_get_static_number_union:
 *
 * Returns: (transfer none): the current static union
 */
const GtkxConformanceNumberUnion *
gtkx_conformance_get_static_number_union(void)
{
    return &static_number_union;
}

/**
 * gtkx_conformance_set_static_number_union:
 * @number: the union's new integer value
 */
void
gtkx_conformance_set_static_number_union(gint32 number)
{
    static_number_union.number = number;
}

/**
 * gtkx_conformance_fill_pod_none:
 * @number: the output record's integer value
 * @ratio: the output record's floating-point value
 * @pod: (out caller-allocates) (transfer none): the record to populate
 */
void
gtkx_conformance_fill_pod_none(gint32 number, gdouble ratio, GtkxConformancePod *pod)
{
    pod->number = number;
    pod->ratio = ratio;
}

/**
 * gtkx_conformance_fill_pod_full:
 * @number: the output record's integer value
 * @ratio: the output record's floating-point value
 * @pod: (out caller-allocates) (transfer full): the record to populate
 */
void
gtkx_conformance_fill_pod_full(gint32 number, gdouble ratio, GtkxConformancePod *pod)
{
    pod->number = number;
    pod->ratio = ratio;
}

/**
 * gtkx_conformance_sum_pod_array_none:
 * @pods: (array length=length) (transfer none): the records to sum
 * @length: the number of records
 *
 * Returns: the sum of every record field
 */
gint32
gtkx_conformance_sum_pod_array_none(const GtkxConformancePod *pods, gsize length)
{
    return sum_pod_array(pods, length);
}

/**
 * gtkx_conformance_sum_pod_array_container:
 * @pods: (array length=length) (transfer container): the records to sum
 * @length: the number of records
 *
 * Returns: the sum of every record field
 */
gint32
gtkx_conformance_sum_pod_array_container(GtkxConformancePod *pods, gsize length)
{
    gint32 total = sum_pod_array(pods, length);

    g_free(pods);

    return total;
}

/**
 * gtkx_conformance_sum_pod_array_full:
 * @pods: (array length=length) (transfer full): the records to sum
 * @length: the number of records
 *
 * Returns: the sum of every record field
 */
gint32
gtkx_conformance_sum_pod_array_full(GtkxConformancePod *pods, gsize length)
{
    gint32 total = sum_pod_array(pods, length);

    g_free(pods);

    return total;
}

/**
 * gtkx_conformance_set_array_pods:
 * @first_number: the first record's integer value
 * @first_ratio: the first record's floating-point value
 * @second_number: the second record's integer value
 * @second_ratio: the second record's floating-point value
 */
void
gtkx_conformance_set_array_pods(
    gint32 first_number,
    gdouble first_ratio,
    gint32 second_number,
    gdouble second_ratio
)
{
    array_pods[0].number = first_number;
    array_pods[0].ratio = first_ratio;
    array_pods[1].number = second_number;
    array_pods[1].ratio = second_ratio;
}

/**
 * gtkx_conformance_get_borrowed_pods:
 *
 * Returns: (transfer none) (element-type GtkxConformancePod): the static records
 */
GPtrArray *
gtkx_conformance_get_borrowed_pods(void)
{
    return &borrowed_pods;
}

/**
 * gtkx_conformance_create_container_pods:
 *
 * Returns: (transfer container) (element-type GtkxConformancePod): a new container of static records
 */
GPtrArray *
gtkx_conformance_create_container_pods(void)
{
    GPtrArray *pods = g_ptr_array_sized_new(G_N_ELEMENTS(array_pods));

    g_ptr_array_add(pods, &array_pods[0]);
    g_ptr_array_add(pods, &array_pods[1]);

    return pods;
}

/**
 * gtkx_conformance_create_full_pods:
 *
 * Returns: (transfer full) (element-type GtkxConformancePod): a new container of new records
 */
GPtrArray *
gtkx_conformance_create_full_pods(void)
{
    GPtrArray *pods = g_ptr_array_new_full(G_N_ELEMENTS(array_pods), g_free);

    for (guint index = 0; index < G_N_ELEMENTS(array_pods); index++) {
        g_ptr_array_add(pods, g_memdup2(&array_pods[index], sizeof(GtkxConformancePod)));
    }

    return pods;
}

/**
 * gtkx_conformance_create_opaque_container:
 *
 * Returns: (transfer container) (element-type GtkxConformanceOpaque): a new container of opaque records
 */
GPtrArray *
gtkx_conformance_create_opaque_container(void)
{
    GPtrArray *records = g_ptr_array_sized_new(1);

    g_ptr_array_add(records, &opaque_storage);

    return records;
}

/**
 * gtkx_conformance_create_empty_opaque_container:
 *
 * Returns: (transfer container) (element-type GtkxConformanceOpaque): an empty container
 */
GPtrArray *
gtkx_conformance_create_empty_opaque_container(void)
{
    return g_ptr_array_new();
}

/**
 * gtkx_conformance_create_rejected_then_owned:
 * @opaque: (out) (transfer full): an opaque record that cannot be copied
 * @pods: (out) (transfer container) (element-type GtkxConformancePod): an owned container
 */
void
gtkx_conformance_create_rejected_then_owned(
    GtkxConformanceOpaque **opaque,
    GPtrArray **pods
)
{
    output_cleanup_count = 0;
    *opaque = g_malloc0(1);
    *pods = g_ptr_array_new_with_free_func(count_output_cleanup);
    g_ptr_array_add(*pods, &static_pod);
}

/**
 * gtkx_conformance_get_output_cleanup_count:
 *
 * Returns: the number of owned output elements released after the last mixed-output call
 */
guint
gtkx_conformance_get_output_cleanup_count(void)
{
    return output_cleanup_count;
}

/**
 * gtkx_conformance_get_null_opaque:
 *
 * Returns: (transfer none) (nullable): no opaque record
 */
const GtkxConformanceOpaque *
gtkx_conformance_get_null_opaque(void)
{
    return NULL;
}

/**
 * gtkx_conformance_get_null_full_pod:
 *
 * Returns: (transfer none) (nullable): no record
 */
const GtkxConformancePod *
gtkx_conformance_get_null_full_pod(void)
{
    return NULL;
}

/**
 * gtkx_conformance_lifecycle_pod_copy:
 * @pod: (transfer none): the record to copy
 *
 * Returns: (transfer full): a copy of the record
 */
GtkxConformanceLifecyclePod *
gtkx_conformance_lifecycle_pod_copy(const GtkxConformanceLifecyclePod *pod)
{
    GtkxConformanceLifecyclePod *copy = g_memdup2(pod, sizeof(GtkxConformanceLifecyclePod));

    copy->text = g_strdup(pod->text);

    return copy;
}

/**
 * gtkx_conformance_lifecycle_pod_free:
 * @pod: (transfer full): the record to free
 */
void
gtkx_conformance_lifecycle_pod_free(GtkxConformanceLifecyclePod *pod)
{
    g_free(pod->text);
    g_free(pod);
}

/**
 * gtkx_conformance_consume_lifecycle_pod:
 * @pod: (transfer full): the record to consume
 */
void
gtkx_conformance_consume_lifecycle_pod(GtkxConformanceLifecyclePod *pod)
{
    gtkx_conformance_lifecycle_pod_free(pod);
}

/**
 * gtkx_conformance_consume_pod:
 * @pod: (transfer full): the record to consume
 */
void
gtkx_conformance_consume_pod(GtkxConformancePod *pod)
{
    g_free(pod);
}

/**
 * gtkx_conformance_create_full_pod:
 *
 * Returns: (transfer none): a newly allocated record
 */
const GtkxConformancePod *
gtkx_conformance_create_full_pod(void)
{
    GtkxConformancePod *pod = g_new(GtkxConformancePod, 1);
    pod->number = 1;
    pod->ratio = 1.0;
    return pod;
}

/**
 * gtkx_conformance_require_nonnegative:
 * @value: the value to validate
 * @doubled: (out): the doubled value
 * @error: return location for a #GError
 *
 * Returns: %TRUE when @value is nonnegative
 */
gboolean
gtkx_conformance_require_nonnegative(gint32 value, gint32 *doubled, GError **error)
{
    if (value < 0) {
        g_set_error_literal(
            error,
            g_quark_from_static_string("gtkx-conformance-error"),
            1,
            "value must be nonnegative"
        );
        return FALSE;
    }

    *doubled = value * 2;
    return TRUE;
}

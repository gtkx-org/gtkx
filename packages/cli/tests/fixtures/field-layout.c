#include <glib-object.h>

typedef struct {
    gint before;
    gint inline_values[3];
    gint *values;
    gint after;
} FieldLayoutSample;

static FieldLayoutSample *
field_layout_sample_copy(FieldLayoutSample *sample)
{
    FieldLayoutSample *copy = g_memdup2(sample, sizeof *sample);
    copy->values = sample->values == NULL ? NULL : g_memdup2(sample->values, 3 * sizeof(gint));
    return copy;
}

static void
field_layout_sample_free(FieldLayoutSample *sample)
{
    g_free(sample->values);
    g_free(sample);
}

G_DEFINE_BOXED_TYPE(FieldLayoutSample, field_layout_sample,
                   field_layout_sample_copy, field_layout_sample_free)

FieldLayoutSample *
field_layout_sample_new(gboolean blank)
{
    FieldLayoutSample *sample = g_new0(FieldLayoutSample, 1);
    sample->values = g_new0(gint, 3);
    sample->before = 11;
    sample->after = 19;
    if (!blank) {
        for (gint index = 0; index < 3; index++) {
            sample->inline_values[index] = index + 1;
            sample->values[index] = index + 4;
        }
    }
    return sample;
}

gint
field_layout_sample_read_before(FieldLayoutSample *sample)
{
    return sample->before;
}

gint
field_layout_sample_read_after(FieldLayoutSample *sample)
{
    return sample->after;
}

gint
field_layout_sample_read_inline_total(FieldLayoutSample *sample)
{
    return sample->inline_values[0] + sample->inline_values[1] + sample->inline_values[2];
}

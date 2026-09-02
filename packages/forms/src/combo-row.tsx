import type * as Adw from "@gtkx/gi/adw";
import type { ReactNode } from "react";
import { ComboRow as BaseComboRow } from "@gtkx/components";
import { type FieldValues, useController } from "react-hook-form";
import type { ComboRowProps, FormFieldPath } from "./types.js";
import { useFieldWidget, widgetProps } from "./internal/field.js";

/** Renders an ID-based Adwaita combo row controlled by React Hook Form. */
function ComboRow<
    TFieldValues extends FieldValues = FieldValues,
    TName extends FormFieldPath<TFieldValues, string> = FormFieldPath<TFieldValues, string>,
    TTransformedValues = TFieldValues,
    TItem = unknown,
    TSection = unknown,
>(props: ComboRowProps<TFieldValues, TName, TTransformedValues, TItem, TSection>): ReactNode {
    const { field, fieldState } = useController<TFieldValues, TName, TTransformedValues>(props);
    const rowProps = widgetProps(props);

    const binding = useFieldWidget<Adw.ComboRow>(field, fieldState, rowProps);

    const selectedId = typeof field.value === "string" ? field.value : null;

    return (
        <BaseComboRow
            {...rowProps}
            {...binding}
            selectedId={selectedId}
            onSelectionChanged={(id) => {
                field.onChange(id);
                rowProps.onSelectionChanged?.(id);
            }}
        />
    );
}

export { ComboRow };

import type * as Adw from "@gtkx/gi/adw";
import type { ReactNode } from "react";
import { ComboRow as BaseComboRow } from "@gtkx/components";
import { type FieldPathByValue, type FieldValues, useController } from "react-hook-form";
import type { ComboRowProps } from "./types.js";
import { useFieldWidget, widgetProps } from "./internal/field.js";

/** Renders an ID-based Adwaita combo row controlled by React Hook Form. */
function ComboRow<
    TFieldValues extends FieldValues = FieldValues,
    TName extends FieldPathByValue<TFieldValues, string> = FieldPathByValue<TFieldValues, string>,
    TTransformedValues = TFieldValues,
    TItem = unknown,
    TSection = unknown,
>(props: ComboRowProps<TFieldValues, TName, TTransformedValues, TItem, TSection>): ReactNode {
    const { field, fieldState } = useController<TFieldValues, TName, TTransformedValues>(props);
    const rowProps = widgetProps(props);

    const binding = useFieldWidget<Adw.ComboRow>(field, fieldState, rowProps);

    return (
        <BaseComboRow
            {...rowProps}
            {...binding}
            selectedId={field.value}
            onSelectionChanged={(id) => {
                if (id !== null) {
                    field.onChange(id);
                }

                rowProps.onSelectionChanged?.(id);
            }}
        />
    );
}

export { ComboRow };

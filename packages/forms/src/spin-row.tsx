import type * as Adw from "@gtkx/gi/adw";
import type { ReactNode } from "react";
import { AdwSpinRow } from "@gtkx/jsx/adw";
import { type FieldValues, useController } from "react-hook-form";
import type { FormFieldPath, SpinRowProps } from "./types.js";
import { selectText, useFieldWidget, widgetProps } from "./internal/field.js";

/** Renders an `Adw.SpinRow` controlled by React Hook Form. */
function SpinRow<
    TFieldValues extends FieldValues = FieldValues,
    TName extends FormFieldPath<TFieldValues, number> = FormFieldPath<TFieldValues, number>,
    TTransformedValues = TFieldValues,
>(props: SpinRowProps<TFieldValues, TName, TTransformedValues>): ReactNode {
    const { field, fieldState } = useController<TFieldValues, TName, TTransformedValues>(props);
    const rowProps = widgetProps(props);

    const binding = useFieldWidget<Adw.SpinRow>(field, fieldState, rowProps, selectText);

    const value = typeof field.value === "number" ? field.value : 0;

    return (
        <AdwSpinRow
            {...rowProps}
            {...binding}
            value={value}
            onNotifyValue={(nextValue, row) => {
                field.onChange(nextValue ?? 0);
                rowProps.onNotifyValue?.(nextValue, row);
            }}
        />
    );
}

export { SpinRow };

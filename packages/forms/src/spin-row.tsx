import type * as Adw from "@gtkx/gi/adw";
import type { ReactNode } from "react";
import { AdwSpinRow } from "@gtkx/jsx/adw";
import { type FieldValues, useController } from "react-hook-form";
import type { FormFieldPath, SpinRowProps } from "./types.js";
import { useFieldWidget, widgetProps } from "./internal/field.js";

const selectText = (row: Adw.SpinRow): void => {
    row.selectRegion(0, -1);
};

/** Renders an `Adw.SpinRow` controlled by React Hook Form. */
function SpinRow<
    TFieldValues extends FieldValues = FieldValues,
    TName extends FormFieldPath<TFieldValues, number> = FormFieldPath<TFieldValues, number>,
    TTransformedValues = TFieldValues,
>(props: SpinRowProps<TFieldValues, TName, TTransformedValues>): ReactNode {
    const { field, fieldState } = useController<TFieldValues, TName, TTransformedValues>(props);
    const rowProps = widgetProps(props);

    const binding = useFieldWidget<Adw.SpinRow>(
        {
            controllerRef: field.ref,
            forwardedRef: rowProps.ref,
            controllers: rowProps.controllers,
            cssClasses: rowProps.cssClasses,
            sensitive: rowProps.sensitive,
            tooltipText: rowProps.tooltipText,
            disabled: field.disabled,
            isInvalid: fieldState.invalid,
            errorMessage: fieldState.error?.message,
            select: selectText,
        },
        field.onBlur,
    );

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

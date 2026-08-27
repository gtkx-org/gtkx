import type * as Adw from "@gtkx/gi/adw";
import type { ReactNode } from "react";
import { AdwSwitchRow } from "@gtkx/jsx/adw";
import { type FieldValues, useController } from "react-hook-form";
import type { FormFieldPath, SwitchRowProps } from "./types.js";
import { useFieldWidget, widgetProps } from "./internal/field.js";

/** Renders an `Adw.SwitchRow` controlled by React Hook Form. */
function SwitchRow<
    TFieldValues extends FieldValues = FieldValues,
    TName extends FormFieldPath<TFieldValues, boolean> = FormFieldPath<TFieldValues, boolean>,
    TTransformedValues = TFieldValues,
>(props: SwitchRowProps<TFieldValues, TName, TTransformedValues>): ReactNode {
    const { field, fieldState } = useController<TFieldValues, TName, TTransformedValues>(props);
    const rowProps = widgetProps(props);

    const binding = useFieldWidget<Adw.SwitchRow>(
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
        },
        field.onBlur,
    );

    return (
        <AdwSwitchRow
            {...rowProps}
            {...binding}
            active={field.value === true}
            onNotifyActive={(active, row) => {
                field.onChange(active === true);
                rowProps.onNotifyActive?.(active, row);
            }}
        />
    );
}

export { SwitchRow };

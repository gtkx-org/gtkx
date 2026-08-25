import type * as Adw from "@gtkx/gi/adw";
import type { ReactNode } from "react";
import { AdwPasswordEntryRow } from "@gtkx/jsx/adw";
import { type FieldValues, useController } from "react-hook-form";
import type { FormFieldPath, PasswordEntryRowProps } from "./types.js";
import { useFieldWidget, widgetProps } from "./internal/field.js";

const selectText = (row: Adw.PasswordEntryRow): void => {
    row.selectRegion(0, -1);
};

/** Renders an `Adw.PasswordEntryRow` controlled by React Hook Form. */
function PasswordEntryRow<
    TFieldValues extends FieldValues = FieldValues,
    TName extends FormFieldPath<TFieldValues, string> = FormFieldPath<TFieldValues, string>,
    TTransformedValues = TFieldValues,
>(props: PasswordEntryRowProps<TFieldValues, TName, TTransformedValues>): ReactNode {
    const { field, fieldState } = useController<TFieldValues, TName, TTransformedValues>(props);
    const rowProps = widgetProps(props);

    const binding = useFieldWidget<Adw.PasswordEntryRow>(
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

    const value = typeof field.value === "string" ? field.value : "";

    return (
        <AdwPasswordEntryRow
            {...rowProps}
            {...binding}
            text={value}
            onNotifyText={(text, row) => {
                field.onChange(text ?? "");
                rowProps.onNotifyText?.(text, row);
            }}
        />
    );
}

export { PasswordEntryRow };

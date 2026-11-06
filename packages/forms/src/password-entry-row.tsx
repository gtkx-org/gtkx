import type * as Adw from "@gtkx/gi/adw";
import type { ReactNode } from "react";
import { AdwPasswordEntryRow } from "@gtkx/jsx/adw";
import { type FieldValues, useController } from "react-hook-form";
import type { FormFieldPath, PasswordEntryRowProps } from "./types.js";
import { useEditableFieldWidget, widgetProps } from "./internal/field.js";

/** Renders an `Adw.PasswordEntryRow` controlled by React Hook Form. */
function PasswordEntryRow<
    TFieldValues extends FieldValues = FieldValues,
    TName extends FormFieldPath<TFieldValues, string> = FormFieldPath<TFieldValues, string>,
    TTransformedValues = TFieldValues,
>(props: PasswordEntryRowProps<TFieldValues, TName, TTransformedValues>): ReactNode {
    const { field, fieldState } = useController<TFieldValues, TName, TTransformedValues>(props);
    const rowProps = widgetProps(props);

    const value = field.value ?? "";
    const binding = useEditableFieldWidget(field, fieldState, rowProps, {
        value,
        read: (row: Adw.PasswordEntryRow) => row.getText(),
    });

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

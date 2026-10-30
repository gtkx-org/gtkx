import type * as Adw from "@gtkx/gi/adw";
import type { ReactNode } from "react";
import { AdwEntryRow } from "@gtkx/jsx/adw";
import { type FieldValues, useController } from "react-hook-form";
import type { EntryRowProps, FormFieldPath } from "./types.js";
import { useEditableFieldWidget, widgetProps } from "./internal/field.js";

/** Renders an `Adw.EntryRow` controlled by React Hook Form. */
function EntryRow<
    TFieldValues extends FieldValues = FieldValues,
    TName extends FormFieldPath<TFieldValues, string> = FormFieldPath<TFieldValues, string>,
    TTransformedValues = TFieldValues,
>(props: EntryRowProps<TFieldValues, TName, TTransformedValues>): ReactNode {
    const { field, fieldState } = useController<TFieldValues, TName, TTransformedValues>(props);
    const rowProps = widgetProps(props);

    const value = field.value ?? "";
    const binding = useEditableFieldWidget(field, fieldState, rowProps, {
        value,
        read: (row: Adw.EntryRow) => row.getText(),
    });

    return (
        <AdwEntryRow
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

export { EntryRow };

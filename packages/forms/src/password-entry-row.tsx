import type * as Adw from "@gtkx/gi/adw";
import type { ReactNode } from "react";
import { AdwPasswordEntryRow } from "@gtkx/jsx/adw";
import { type FieldValues, useController } from "react-hook-form";
import type { FormFieldPath, PasswordEntryRowProps } from "./types.js";
import { selectText, useFieldWidget, widgetProps } from "./internal/field.js";

/** Renders an `Adw.PasswordEntryRow` controlled by React Hook Form. */
function PasswordEntryRow<
    TFieldValues extends FieldValues = FieldValues,
    TName extends FormFieldPath<TFieldValues, string> = FormFieldPath<TFieldValues, string>,
    TTransformedValues = TFieldValues,
>(props: PasswordEntryRowProps<TFieldValues, TName, TTransformedValues>): ReactNode {
    const { field, fieldState } = useController<TFieldValues, TName, TTransformedValues>(props);
    const rowProps = widgetProps(props);

    const binding = useFieldWidget<Adw.PasswordEntryRow>(field, fieldState, rowProps, selectText);

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

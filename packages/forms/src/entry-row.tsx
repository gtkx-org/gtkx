import type * as Adw from "@gtkx/gi/adw";
import type { ReactNode } from "react";
import { AdwEntryRow } from "@gtkx/jsx/adw";
import { type FieldValues, useController } from "react-hook-form";
import type { EntryRowProps, FormFieldPath } from "./types.js";
import { selectText, useFieldWidget, widgetProps } from "./internal/field.js";

/** Renders an `Adw.EntryRow` controlled by React Hook Form. */
function EntryRow<
    TFieldValues extends FieldValues = FieldValues,
    TName extends FormFieldPath<TFieldValues, string> = FormFieldPath<TFieldValues, string>,
    TTransformedValues = TFieldValues,
>(props: EntryRowProps<TFieldValues, TName, TTransformedValues>): ReactNode {
    const { field, fieldState } = useController<TFieldValues, TName, TTransformedValues>(props);
    const rowProps = widgetProps(props);

    const binding = useFieldWidget<Adw.EntryRow>(field, fieldState, rowProps, selectText);

    const value = typeof field.value === "string" ? field.value : "";

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

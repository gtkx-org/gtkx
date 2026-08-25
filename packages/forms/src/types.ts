import type { ComboRowProps as BaseComboRowProps } from "@gtkx/components/adw";
import type {
    AdwEntryRowProps,
    AdwPasswordEntryRowProps,
    AdwSpinRowProps,
    AdwSwitchRowProps,
} from "@gtkx/jsx/adw";
import type { FieldPath, FieldPathByValue, FieldValues, UseControllerProps } from "react-hook-form";

/** A form field path whose value can be represented by a GTKX control. */
type FormFieldPath<TFieldValues extends FieldValues, TValue> = FieldPathByValue<
    TFieldValues,
    TValue | null | undefined
>;

/** React Hook Form controller options shared by every GTKX form field. */
type FormFieldProps<
    TFieldValues extends FieldValues = FieldValues,
    TName extends FieldPath<TFieldValues> = FieldPath<TFieldValues>,
    TTransformedValues = TFieldValues,
> = UseControllerProps<TFieldValues, TName, TTransformedValues>;

/** Props for an Adwaita entry row controlled by React Hook Form. */
type EntryRowProps<
    TFieldValues extends FieldValues = FieldValues,
    TName extends FormFieldPath<TFieldValues, string> = FormFieldPath<TFieldValues, string>,
    TTransformedValues = TFieldValues,
> = Omit<AdwEntryRowProps, "accessibleInvalid" | "text"> &
    FormFieldProps<TFieldValues, TName, TTransformedValues>;

/** Props for an Adwaita password entry row controlled by React Hook Form. */
type PasswordEntryRowProps<
    TFieldValues extends FieldValues = FieldValues,
    TName extends FormFieldPath<TFieldValues, string> = FormFieldPath<TFieldValues, string>,
    TTransformedValues = TFieldValues,
> = Omit<AdwPasswordEntryRowProps, "accessibleInvalid" | "text"> &
    FormFieldProps<TFieldValues, TName, TTransformedValues>;

/** Props for an Adwaita switch row controlled by React Hook Form. */
type SwitchRowProps<
    TFieldValues extends FieldValues = FieldValues,
    TName extends FormFieldPath<TFieldValues, boolean> = FormFieldPath<TFieldValues, boolean>,
    TTransformedValues = TFieldValues,
> = Omit<AdwSwitchRowProps, "accessibleInvalid" | "active"> &
    FormFieldProps<TFieldValues, TName, TTransformedValues>;

/** Props for an Adwaita spin row controlled by React Hook Form. */
type SpinRowProps<
    TFieldValues extends FieldValues = FieldValues,
    TName extends FormFieldPath<TFieldValues, number> = FormFieldPath<TFieldValues, number>,
    TTransformedValues = TFieldValues,
> = Omit<AdwSpinRowProps, "accessibleInvalid" | "text" | "value"> &
    FormFieldProps<TFieldValues, TName, TTransformedValues>;

/** Props for an ID-based Adwaita combo row controlled by React Hook Form. */
type ComboRowProps<
    TFieldValues extends FieldValues = FieldValues,
    TName extends FormFieldPath<TFieldValues, string> = FormFieldPath<TFieldValues, string>,
    TTransformedValues = TFieldValues,
    TItem = unknown,
    TSection = unknown,
> = Omit<BaseComboRowProps<TItem, TSection>, "accessibleInvalid" | "selectedId"> &
    FormFieldProps<TFieldValues, TName, TTransformedValues>;

export {
    type ComboRowProps,
    type EntryRowProps,
    type FormFieldPath,
    type FormFieldProps,
    type PasswordEntryRowProps,
    type SpinRowProps,
    type SwitchRowProps,
};

---
title: "Forms"
description: "Build typed Adwaita forms with @gtkx/forms and React Hook Form: controlled rows, validation, focus, disabled fields, and programmatic updates."
---

# Forms

GTKX applications use Adwaita for their application surfaces, and `@gtkx/forms` carries that foundation into forms by connecting [React Hook Form](https://react-hook-form.com) to Adwaita's form rows. The form state, validation rules, nested field names, and submission flow come from React Hook Form; `EntryRow`, `PasswordEntryRow`, `SwitchRow`, `SpinRow`, and `ComboRow` bind that state to native Adwaita controls.

Install it separately:

```bash
npm install @gtkx/forms
```

The controls need the generated `@gtkx/jsx/adw` bindings. A project scaffolded by `npm create gtkx` already has them, through [`v2DefaultLibraries`](/guide/configuration-and-codegen#future-flags). A legacy GTK-only project adds `Adw-1` in `gtkx.config.ts` before adopting the same foundation:

```diff
 export default defineConfig({
-    libraries: ["Gtk-4.0"],
+    libraries: ["Gtk-4.0", "Adw-1"],
     applicationId: "com.example.account",
 });
```

The next `gtkx dev`, `gtkx build`, or `gtkx codegen` regenerates the bindings. The package also re-exports `useForm`, `FormProvider`, `Controller`, `useController`, `useFieldArray`, `useFormContext`, `useFormState`, and `useWatch`, plus the common types used with them. Importing the provider and hooks from `@gtkx/forms` keeps them on the same React Hook Form context as the rows. Full signatures are in the [@gtkx/forms reference](/reference/@gtkx/forms/).

## A complete typed form

Give `useForm` the shape saved by the form and complete `defaultValues`. Each row's `name` is then restricted to paths holding the value that row represents: strings for entry and combo rows, a number for a spin row, and a boolean for a switch row.

```tsx
import { AdwPreferencesGroup } from "@gtkx/jsx/adw";
import * as Gtk from "@gtkx/gi/gtk";
import { GtkAdjustment, GtkBox, GtkButton } from "@gtkx/jsx/gtk";
import {
    ComboRow,
    EntryRow,
    FormProvider,
    PasswordEntryRow,
    SpinRow,
    SwitchRow,
    useForm,
} from "@gtkx/forms";

type AccountValues = {
    displayName: string;
    password: string;
    notifications: boolean;
    retryCount: number;
    theme: string;
};

type AccountFormProps = {
    onSave: (values: AccountValues) => void | Promise<void>;
};

const themes = [
    { id: "system", value: "Follow system" },
    { id: "light", value: "Light" },
    { id: "dark", value: "Dark" },
];

export const AccountForm = ({ onSave }: AccountFormProps) => {
    const form = useForm<AccountValues>({
        defaultValues: {
            displayName: "",
            password: "",
            notifications: true,
            retryCount: 3,
            theme: "system",
        },
        mode: "onBlur",
    });
    const submit = form.handleSubmit(onSave);

    return (
        <FormProvider {...form}>
            <GtkBox orientation={Gtk.Orientation.VERTICAL} spacing={18}>
                <AdwPreferencesGroup title="Account">
                    <EntryRow<AccountValues>
                        name="displayName"
                        title="Display name"
                        rules={{ required: "Enter a display name" }}
                    />
                    <PasswordEntryRow<AccountValues>
                        name="password"
                        title="Password"
                        rules={{
                            minLength: { value: 12, message: "Use at least 12 characters" },
                        }}
                    />
                    <SwitchRow<AccountValues>
                        name="notifications"
                        title="Notifications"
                    />
                    <SpinRow<AccountValues>
                        name="retryCount"
                        title="Retry attempts"
                        adjustment={
                            <GtkAdjustment
                                lower={0}
                                upper={10}
                                stepIncrement={1}
                                pageIncrement={1}
                            />
                        }
                        rules={{
                            min: { value: 0, message: "Use zero or more retries" },
                            max: { value: 10, message: "Use no more than 10 retries" },
                        }}
                    />
                    <ComboRow
                        control={form.control}
                        name="theme"
                        title="Theme"
                        items={themes}
                        rules={{ required: "Choose a theme" }}
                    />
                </AdwPreferencesGroup>
                <GtkButton
                    label="Save"
                    halign={Gtk.Align.END}
                    cssClasses={["suggested-action"]}
                    sensitive={!form.formState.isSubmitting}
                    onClicked={() => {
                        void submit();
                    }}
                />
            </GtkBox>
        </FormProvider>
    );
};
```

`FormProvider` supplies the `control` to every row below it. A row can instead be used without a provider by passing `control={form.control}` directly. The GTK button is not an HTML submit button, so its `onClicked` calls the function returned by `handleSubmit`; that function validates first and hands `onSave` a typed `AccountValues` only when the form is valid.

The rows keep their underlying native props and handlers, apart from the value prop that React Hook Form owns. Their mappings are:

| Component | Form value | Native state |
| --- | --- | --- |
| `EntryRow` | `string` | `Adw.EntryRow:text` |
| `PasswordEntryRow` | `string` | `Adw.PasswordEntryRow:text` |
| `SwitchRow` | `boolean` | `Adw.SwitchRow:active` |
| `SpinRow` | `number` | `Adw.SpinRow:value` |
| `ComboRow` | `string` | selected item ID |

`ComboRow` takes the same `items`, `sections`, and renderer props as [`ComboRow` from `@gtkx/components/adw`](/guide/components#dropdown). Passing `control={form.control}`, as in the example, lets TypeScript infer both the form field path and the item and section types used by those renderers. The stored value is the stable item `id`, not its current position or display value, so reordering or relabeling the items does not change the submitted value.

## Validation feedback

Pass React Hook Form's `rules` to any row. When a field is invalid, the row:

- gains Adwaita's `error` CSS class while preserving the classes passed in `cssClasses`,
- exposes `Gtk.AccessibleInvalidState.TRUE` to assistive technology, and
- uses the rule's error message as its tooltip when one is present.

When the field becomes valid, the added class is removed, its accessible invalid state returns to `FALSE`, and the row's original `tooltipText` is restored. Give a rule such as `required` the string message `Enter a name` when the tooltip should explain the problem; a boolean rule can mark the row invalid but has no message to show.

The tooltip and accessible state augment the color change, but neither adds a permanently visible message below the row. For a form that needs one, read `formState.errors`, `useFormState`, or `Controller` and render that text in the surrounding layout.

## Disabled fields

The `disabled` prop has React Hook Form semantics: the row becomes insensitive and its value is omitted from submitted data. Set the native `sensitive` prop to `false` instead when the row should stop accepting input but remain registered and included in the result.

Disabling the entire form through React Hook Form disables the rows the same way. A caller's `sensitive` value of `false` is preserved when the form field itself is enabled.

## Focus and blur

React Hook Form's focus APIs reach the native widget. `setFocus("displayName")`, `setError` with `shouldFocus: true`, and the default focus-on-first-error behavior all call GTK's `grabFocus()` through the row adapter. Text and spin rows also support selection:

```tsx
form.setFocus("displayName", { shouldSelect: true });
```

Each row tracks focus across its whole native subtree. Leaving the row, rather than moving between widgets inside it, marks the field touched and runs `onBlur` validation. Any event controllers passed through the row's `controllers` prop stay attached alongside that focus tracking.

## Reset and programmatic values

The controls are fully controlled by React Hook Form. `reset`, `resetField`, and `setValue` write their next values back to the native rows:

```tsx
form.setValue("theme", "dark", { shouldDirty: true });

form.reset({
    displayName: "Ada",
    password: "",
    notifications: false,
    retryCount: 1,
    theme: "system",
});
```

Those controlled writes do not echo back as user edits. Native change handlers passed to a form row still run after React Hook Form receives an actual edit, so `onNotifyText`, `onNotifyActive`, `onNotifyValue`, and `onSelectionChanged` can observe user interaction without taking ownership of the value.

Complete `defaultValues` give each controlled row its value on the first render and give React Hook Form a stable baseline for `isDirty`. Without one, text rows display an empty string, switch rows display `false`, spin rows display `0`, and a combo row has no selected ID until the form supplies one.

## Custom GTK controls

Use the re-exported `Controller` when a form needs a GTK control without a dedicated row. Its render callback supplies the value and handlers; the custom adapter remains responsible for translating the native signal, focus, blur, and validation appearance:

```tsx
import { Controller, useForm } from "@gtkx/forms";
import * as Gtk from "@gtkx/gi/gtk";
import { GtkCheckButton, GtkEventControllerFocus } from "@gtkx/jsx/gtk";

type Options = { compact: boolean };

export const CompactOption = () => {
    const form = useForm<Options>({ defaultValues: { compact: false } });

    return (
        <Controller
            control={form.control}
            name="compact"
            rules={{ required: "Compact mode must be enabled" }}
            render={({ field, fieldState }) => (
                <GtkCheckButton
                    label="Compact mode"
                    active={field.value}
                    cssClasses={fieldState.invalid ? ["error"] : undefined}
                    accessibleInvalid={
                        fieldState.invalid
                            ? Gtk.AccessibleInvalidState.TRUE
                            : Gtk.AccessibleInvalidState.FALSE
                    }
                    ref={(button) => {
                        field.ref(
                            button === null
                                ? null
                                : {
                                      focus: () => {
                                          button.grabFocus();
                                      },
                                  },
                        );
                    }}
                    controllers={<GtkEventControllerFocus onLeave={field.onBlur} />}
                    onToggled={(button) => {
                        field.onChange(button.active);
                    }}
                />
            )}
        />
    );
};
```

The focus proxy is deliberate: GTK's `focus` method takes a direction, while React Hook Form expects a no-argument `focus()` handle. Calling `grabFocus()` is the bridge the built-in form rows use too.

## Next

Continue with [Modals and Portals](/guide/modals-and-portals) for forms that open in a dialog, or [Testing](/guide/testing) to drive the controls and assert submitted values.

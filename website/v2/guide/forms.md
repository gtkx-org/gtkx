---
title: "Forms"
description: "Connect React Hook Form to native Adwaita rows, focus and validation feedback."
---

# Forms

`@gtkx/forms` connects [React Hook Form](https://react-hook-form.com) to native Adwaita rows. This page covers what is GTKX-specific: native input, focus and validation feedback. For form state, validation rules and submission, see the [React Hook Form documentation](https://react-hook-form.com/docs).

Install the package:

```bash
npm install @gtkx/forms@beta
```

The rows use the generated `@gtkx/jsx/adw` bindings included in GTKX 2 projects.

## Connect a form

Pass `control={form.control}` to infer the row's field names from your form type. GTK buttons submit through `onClicked`:

```tsx
import { ComboRow, EntryRow, useForm } from "@gtkx/forms";
import * as Gtk from "@gtkx/gi/gtk";
import { AdwPreferencesGroup } from "@gtkx/jsx/adw";
import { GtkBox, GtkButton } from "@gtkx/jsx/gtk";

type Preferences = { displayName: string; theme: string };

const themes = [
    { id: "system", value: "Follow system" },
    { id: "light", value: "Light" },
    { id: "dark", value: "Dark" },
];

export const PreferencesForm = ({ onSave }: { onSave: (values: Preferences) => void }) => {
    const form = useForm<Preferences>({
        defaultValues: { displayName: "", theme: "system" },
    });
    const submit = form.handleSubmit(onSave);

    return (
        <GtkBox orientation={Gtk.Orientation.VERTICAL} spacing={18}>
            <AdwPreferencesGroup title="Preferences">
                <EntryRow
                    control={form.control}
                    name="displayName"
                    title="Display name"
                    rules={{ required: "Enter a display name" }}
                />
                <ComboRow
                    control={form.control}
                    name="theme"
                    title="Theme"
                    items={themes}
                />
            </AdwPreferencesGroup>
            <GtkButton label="Save" onClicked={() => { void submit(); }} />
        </GtkBox>
    );
};
```

You can also import `FormProvider` from `@gtkx/forms` to supply the control to rows below it. When a row relies on the provider, give it the form type explicitly, such as `<EntryRow<Preferences> name="displayName" />`, to check its field name.

## React Compiler

GTKX compiles components with the React Compiler [by default](/v2/guide/configuration-and-codegen), so read a field with `useWatch` rather than `form.watch`. As [React Hook Form documents](https://react-hook-form.com/docs/useform/watch), the compiler can cache what `watch` returns, and the component keeps showing a stale value after `setValue`:

```tsx
import { useWatch } from "@gtkx/forms";

const theme = useWatch({ control: form.control, name: "theme" });
```

React Hook Form also updates nested `formState.errors` objects in place, so the compiler can keep rendering an old result for a message read below a field array or a nested object. For example, once `errors.stops` holds an error for an empty row, a field array `validate` rule that fails on submit adds `root` to that same object, and a label showing `errors.stops?.root?.message` never appears. Add the [`"use no memo"`](https://react.dev/reference/react-compiler/directives/use-no-memo) directive at the top of a component that renders such messages:

```tsx
import { useFieldArray, useForm } from "@gtkx/forms";
import { GtkLabel } from "@gtkx/jsx/gtk";

type Trip = { stops: { city: string; nights: number }[] };

const StopsError = () => {
    "use no memo";
    const form = useForm<Trip>({ defaultValues: { stops: [] } });
    useFieldArray({
        control: form.control,
        name: "stops",
        rules: { validate: (stops) => stops.length <= 6 || "Plan at most six stops" },
    });
    const message = form.formState.errors.stops?.root?.message;

    return message ? <GtkLabel cssClasses={["error"]} label={message} /> : null;
};
```

## Choose a row

| Row                            | Stored value |
| ------------------------------ | ------------ |
| `EntryRow`, `PasswordEntryRow` | Text         |
| `SwitchRow`                    | Boolean      |
| `SpinRow`                      | Number       |
| `ComboRow`                     | Item ID      |

The rows retain their native props, children, refs and signal handlers.

React Hook Form owns the value, so configure a spin row's range by passing a JSX `GtkAdjustment` to its `adjustment` prop, such as `adjustment={<GtkAdjustment lower={1} upper={10} stepIncrement={1} />}`, and use `setValue` or `reset` to change its current value. Those form updates do not echo back as user edits.

If GTK clamps a value to the adjustment's range or cuts text at `maxLength`, the form keeps the stored value and submits it. The row is marked invalid, and a development build logs a warning, until an edit replaces the value.

`ComboRow` takes the same `items`, `sections` and renderers as the [collection `DropDown`](/v2/guide/components#dropdown) and stores the selected item's ID, which stays stable when items move or their labels change. Passing `control` also lets TypeScript infer item and section types for renderers.

A form `ComboRow` uses a non-nullable string field. Supply an explicit default ID that exists in its choices. An empty source preserves that ID, so asynchronously reloaded choices restore the selection without changing the form's value or dirty state. See the [React Hook Form defaults guidance](https://react-hook-form.com/docs/useform#defaultValues) for asynchronous defaults and resets.

## Native validation feedback

An invalid row gains Adwaita's `error` CSS class. The row and, for text and spin rows, the field that receives focus expose an accessible invalid state. When validation supplies a message, the row uses it as its tooltip. Correcting the field restores the caller's classes and tooltip.

The rows do not add a persistent error label. Render one beside the row when your application needs visible feedback. Native handlers such as `onNotifyText` still run after the form receives an edit.

## Focus and disabled fields

Form focus operations, including focus on the first invalid field, reach the native row through `grabFocus()`. Text and spin rows also support `setFocus(name, { shouldSelect: true })`. Forwarded refs receive the native row and preserve React callback-ref cleanup.

Leaving the row's native subtree marks the field touched and supports blur validation. Moving focus between widgets inside the same row does not. Any controllers passed through `controllers` remain attached alongside this tracking.

`disabled` makes a row insensitive and omits its value from submission. Use the native `sensitive={false}` prop when the value should remain in the submitted form. Disabling the whole form also disables its rows.

## Other GTK controls

For a control without a form row, use [`Controller`](https://react-hook-form.com/docs/usecontroller/controller) from `@gtkx/forms` and connect its `field` to the control's props and signals:

```tsx
import { Controller, useForm } from "@gtkx/forms";
import { GtkCheckButton, GtkEventControllerFocus } from "@gtkx/jsx/gtk";

type Terms = { accepted: boolean };

export const TermsForm = () => {
    const form = useForm<Terms>({ defaultValues: { accepted: false } });

    return (
        <Controller
            control={form.control}
            name="accepted"
            rules={{ required: "Accept the terms to continue" }}
            render={({ field, fieldState }) => (
                <GtkCheckButton
                    label="I accept the terms"
                    active={field.value}
                    onToggled={(button) => field.onChange(button.getActive())}
                    ref={(button) => field.ref(button && { focus: () => button.grabFocus() })}
                    cssClasses={fieldState.invalid ? ["error"] : []}
                    controllers={<GtkEventControllerFocus onLeave={field.onBlur} />}
                />
            )}
        />
    );
};
```

`field.ref` needs a handle with a no-argument `focus()` method. Passing the widget directly does not work, because GTK's `focus` method expects a direction. `GtkEventControllerFocus` reports when focus leaves the control, which marks the field touched.

See the [forms reference](/v2/reference/@gtkx/forms/) for GTKX prop types and the [testing guide](/v2/guide/testing) for driving native controls.

## Next

Continue with [Modals and Portals](/v2/guide/modals-and-portals) to open windows and Adwaita dialogs from React state.

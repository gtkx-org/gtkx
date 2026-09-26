---
title: "Forms"
description: "Connect React Hook Form to native Adwaita rows, focus and validation feedback."
---

# Forms

`@gtkx/forms` connects [React Hook Form](https://react-hook-form.com) to native Adwaita rows. Use it for GTKX-specific input, focus and validation feedback; use the [React Hook Form documentation](https://react-hook-form.com/docs) for form state, validation rules and submission.

Install the package:

```bash
npm install @gtkx/forms@1.6.0
```

The rows need generated `@gtkx/jsx/adw` bindings. New projects include them; existing GTK-only projects can add `Adw-1` through [library configuration](/guide/configuration-and-codegen).

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

## Choose a row

| Row | Stored value |
| --- | --- |
| `EntryRow`, `PasswordEntryRow` | Text |
| `SwitchRow` | Boolean |
| `SpinRow` | Number |
| `ComboRow` | Item ID |

The rows retain their native props, children, refs and signal handlers. React Hook Form owns the value, so configure a spin row's range through a JSX `GtkAdjustment`, and use `setValue` or `reset` to change its current value. Those form updates do not echo back as user edits.

`ComboRow` shares the [collection component's sources and renderers](/guide/components#dropdown). Item IDs remain stable when items move or their labels change. Values have a default text display; pass `renderItem` for application presentation. Passing `control` also lets TypeScript infer item and section types for renderers.

Give a form `ComboRow` an explicit default ID that exists in its choices. An empty source preserves that ID, so asynchronously reloaded choices restore the selection without changing the form's value or dirty state. See the [React Hook Form defaults guidance](https://react-hook-form.com/docs/useform#defaultValues) for asynchronous defaults and resets.

## Native validation feedback

An invalid row gains Adwaita's `error` CSS class and exposes an accessible invalid state. When validation supplies a message, the row uses it as its tooltip. Correcting the field restores the caller's classes and tooltip.

The rows do not add a persistent error label. Render one beside the row when your application needs visible feedback. Native handlers such as `onNotifyText` still run after the form receives an edit.

## Focus and disabled fields

Form focus operations, including focus on the first invalid field, reach the native row through `grabFocus()`. Text and spin rows also support `setFocus(name, { shouldSelect: true })`. Forwarded refs receive the native row.

Leaving the row's native subtree marks the field touched and supports blur validation. Moving focus between widgets inside the same row does not. Any controllers passed through `controllers` remain attached alongside this tracking.

`disabled` makes a row insensitive and omits its value from submission. Use the native `sensitive={false}` prop when the value should remain in the submitted form. Disabling the whole form also disables its rows.

## Other GTK controls

For a control without a form row, use `Controller` from `@gtkx/forms`. Its render callback supplies the form value and handlers; connect them to the control's JSX props and signals. Add `GtkEventControllerFocus` through `controllers` to forward `onLeave` to `field.onBlur`.

Give `field.ref` a handle with a no-argument `focus()` method that calls the widget's `grabFocus()`. Passing the widget directly does not work: GTK's `focus` method expects a direction. Use `fieldState.invalid` to apply the control's validation presentation.

See the [forms reference](/reference/@gtkx/forms/) for GTKX prop types and the [testing guide](/guide/testing) for driving native controls.

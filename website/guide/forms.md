---
title: "Forms"
description: "Build typed Adwaita forms with React Hook Form and native GTK controls."
---

# Forms

`@gtkx/forms` connects React Hook Form to native Adwaita rows. Use it when several controls share validation, dirty state, reset behavior, or one submission boundary.

```bash
npm install @gtkx/forms
```

## Build a typed form

Define the saved value shape, provide complete defaults, and place the rows under `FormProvider`:

```tsx
import { ComboRow, EntryRow, FormProvider, SwitchRow, useForm } from "@gtkx/forms";
import * as Gtk from "@gtkx/gi/gtk";
import { AdwPreferencesGroup } from "@gtkx/jsx/adw";
import { GtkBox, GtkButton } from "@gtkx/jsx/gtk";

type AccountValues = {
    displayName: string;
    notifications: boolean;
    theme: string;
};

const themes = [
    { id: "system", value: "Follow system" },
    { id: "light", value: "Light" },
    { id: "dark", value: "Dark" },
];

export const AccountForm = ({ onSave }: { onSave: (values: AccountValues) => void }) => {
    const form = useForm<AccountValues>({
        defaultValues: { displayName: "", notifications: true, theme: "system" },
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
                    <SwitchRow<AccountValues> name="notifications" title="Notifications" />
                    <ComboRow control={form.control} name="theme" title="Theme" items={themes} />
                </AdwPreferencesGroup>
                <GtkButton
                    label="Save"
                    halign={Gtk.Align.END}
                    sensitive={!form.formState.isSubmitting}
                    onClicked={() => void submit()}
                />
            </GtkBox>
        </FormProvider>
    );
};
```

The generic restricts each `name` to a compatible field. Entry and combo rows store strings, switch rows store booleans, and spin rows store numbers. `ComboRow` saves the stable item ID rather than its position.

GTK buttons have no HTML submit behavior, so call the function returned by `handleSubmit`. It validates first and invokes `onSave` only with valid, typed values.

## Show validation at the row

Pass React Hook Form `rules` directly to a row. An invalid field receives Adwaita's `error` class, an accessible invalid state, and the rule message as its tooltip. Render a separate visible message from `formState.errors` when the workflow needs persistent explanation.

The `disabled` prop uses React Hook Form semantics: the row becomes insensitive and its value is omitted from submission. Use `sensitive={false}` when the value must remain registered.

## Update the form from application state

The rows are controlled, so React Hook Form APIs write back to GTK without being reported as user edits:

```tsx
form.setValue("theme", "dark", { shouldDirty: true });
form.reset({ displayName: "Ada", notifications: false, theme: "system" });
form.setFocus("displayName", { shouldSelect: true });
```

Use `resetField` when an external store changes one field. Complete `defaultValues` give every row a stable initial value and make `isDirty` meaningful.

## Adapt an unsupported control

Use the re-exported `Controller` for a GTK control without a built-in form row. Translate the controller's `value`, `onChange`, `onBlur`, and `ref` into the widget's native prop and signals. The ref must expose a no-argument `focus()` method, commonly by calling the widget's `grabFocus()`.

The built-in row signatures and the complete React Hook Form surface are in the [forms API reference](/reference/@gtkx/forms/).

## Next

[Modals and Portals](/guide/modals-and-portals) places a form in a dialog. [Testing](/guide/testing) shows how to drive it and assert the submitted result.

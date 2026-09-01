---
title: "Forms"
description: "Connect native Adwaita form rows to React Hook Form."
---

# Forms

`@gtkx/forms` adapts React Hook Form to native rows. Use it when controls share validation, dirty state, reset behavior, or submission.

```bash
npm install @gtkx/forms
```

## Build a typed form

```tsx
import { EntryRow, FormProvider, SwitchRow, useForm } from "@gtkx/forms";
import { AdwPreferencesGroup } from "@gtkx/jsx/adw";
import { GtkButton } from "@gtkx/jsx/gtk";

type Values = { name: string; notifications: boolean };

const AccountForm = ({ onSave }: { onSave: (values: Values) => void }) => {
    const form = useForm<Values>({
        defaultValues: { name: "", notifications: true },
        mode: "onBlur",
    });

    return (
        <FormProvider {...form}>
            <AdwPreferencesGroup title="Account">
                <EntryRow<Values> name="name" title="Name" rules={{ required: "Enter a name" }} />
                <SwitchRow<Values> name="notifications" title="Notifications" />
            </AdwPreferencesGroup>
            <GtkButton label="Save" onClicked={() => void form.handleSubmit(onSave)()} />
        </FormProvider>
    );
};
```

Provide complete defaults and call `handleSubmit`; GTK buttons have no HTML submit behavior. Field generics restrict `name` to compatible values. Built-in rows apply invalid styling and accessibility state.

`disabled` follows React Hook Form and omits the value from submission. Use `sensitive={false}` when it must remain registered. Use `Controller` for an unsupported widget and map its value, change, blur, and focus behavior.

The [forms reference](/reference/@gtkx/forms/) and [React Hook Form documentation](https://react-hook-form.com/docs) cover validation and state APIs. [Testing](/guide/testing) shows the user-facing workflow.

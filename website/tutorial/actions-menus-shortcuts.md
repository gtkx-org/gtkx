---
title: "Actions and Desktop Integration"
description: "Add actions, shortcuts, settings, notifications, theming, and localization."
---

# Actions and Desktop Integration

Use a GAction when the same command is reachable from several surfaces. Buttons, menus, shortcuts, notifications, and tests can then invoke one named behavior.

## Centralize commands

The finished app declares window actions in [`window-actions.tsx`](https://github.com/gtkx-org/gtkx/blob/main/examples/tutorial/src/components/window-actions.tsx) and binds accelerators at the application boundary. Keep action handlers thin: select current state, perform one operation, and navigate or present feedback.

Use menu models for the primary menu and `GtkShortcutController` only for shortcuts that do not map naturally to an application or window action. A visible label should mention a shortcut only when that helps discovery.

## Persist preferences

Import the GSettings schema as a relative source import and use `useSetting` or `useBindSetting` for typed values. The example stores color scheme and sort preferences in [`preferences.tsx`](https://github.com/gtkx-org/gtkx/blob/main/examples/tutorial/src/components/preferences.tsx).

Keep preferences separate from task data:

- GSettings holds small user preferences.
- The task store holds user-created domain data.
- Component state holds temporary dialog and search state.

Apply the selected scheme through `Adw.StyleManager`. Use GTK CSS classes and a small `@gtkx/css` rule only where the toolkit has no suitable style class.

## Notify without duplicating behavior

A `Gio.Notification` can target an existing application action. Use this for reminder buttons so clicking a notification follows the same route as clicking inside the app. Request notification permission through normal desktop behavior; do not assume delivery or timing in application state.

The reminder scheduler is in [`use-reminders.ts`](https://github.com/gtkx-org/gtkx/blob/main/examples/tutorial/src/hooks/use-reminders.ts), and notification actions are in [`app.tsx`](https://github.com/gtkx-org/gtkx/blob/main/examples/tutorial/src/app.tsx).

## Localize one catalog

```bash
npm install @gtkx/i18n
mkdir -p po
printf 'fr\n' > po/LINGUAS
gtkx codegen
```

Use static keys through `t`, `useTranslation`, or `Trans`. GTKX extracts them into the application-ID gettext domain and includes translatable desktop metadata in the same catalogs.

```tsx
import { useTranslation } from "@gtkx/i18n";

const EmptyState = () => {
    const { t } = useTranslation();
    return <GtkLabel label={t("No tasks yet")} />;
};
```

Run codegen after message changes and edit only `msgstr` values in PO files. Dynamic keys and aliased translation functions cannot be extracted.

With the application behavior complete, [test its workflows through visible widgets](/tutorial/testing).

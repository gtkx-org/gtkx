---
title: "GTKX 1.5: Native forms and gettext i18n"
description: "GTKX 1.5 adds React Hook Form-powered Adwaita controls and the complete react-i18next API backed by GNU gettext, with strict generated message types and localization automated from codegen through every deploy target."
image: /tasks-forms.png
---

# GTKX 1.5

<p class="post-date">August 27, 2026</p>

GTKX 1.5 is out with two new packages for work almost every application has to do: [`@gtkx/forms`](/guide/forms) connects React Hook Form to native Adwaita controls, and [`@gtkx/i18n`](/guide/internationalization) connects the complete react-i18next API to GNU gettext. Forms stay typed from the saved value to the widget. Translation stays in standard PO catalogs, while the GTKX CLI owns extraction, generated types, compilation, localized desktop metadata, and packaging. Read the [`changelog`](https://github.com/gtkx-org/gtkx/releases/tag/v1.5.0) for the full list of changes.

<picture>
  <source srcset="/tasks-forms.webp" type="image/webp" />
  <img src="/tasks-forms.png" width="900" height="600" loading="lazy" alt="The Tasks app editing a work task in a native Adwaita form, with a changed title ready to apply, an active Important switch, and a due date." />
</picture>

*The tutorial task editor now uses React Hook Form for its native title and importance controls.*

## React Hook Form, rendered by Adwaita

`@gtkx/forms` is an adapter around React Hook Form, not a second form-state implementation. `useForm`, `FormProvider`, `Controller`, field arrays, form context, state, and watchers come from React Hook Form. GTKX supplies the native controls that speak its value, validation, focus, blur, disabled, dirty, reset, and submission protocols:

- `EntryRow` and `PasswordEntryRow` bind string fields to `AdwEntryRow` and `AdwPasswordEntryRow`.
- `SwitchRow` binds a boolean field to `AdwSwitchRow`.
- `SpinRow` binds a number field to `AdwSpinRow`.
- `ComboRow` binds a string field to an Adwaita combo row.

The form's value type restricts each row's `name` to a compatible field path. A text row cannot accidentally bind a boolean, and a nested path is checked against the same object that `handleSubmit` returns:

```tsx
import { EntryRow, FormProvider, SwitchRow, useForm } from "@gtkx/forms";
import { AdwPreferencesGroup } from "@gtkx/jsx/adw";

type TaskFields = {
    important: boolean;
    title: string;
};

const TaskForm = () => {
    const form = useForm<TaskFields>({
        defaultValues: { important: false, title: "" },
    });

    return (
        <FormProvider {...form}>
            <AdwPreferencesGroup>
                <EntryRow<TaskFields>
                    name="title"
                    title="Title"
                    rules={{ required: "Enter a title" }}
                />
                <SwitchRow<TaskFields> name="important" title="Important" />
            </AdwPreferencesGroup>
        </FormProvider>
    );
};
```

Validation is native too. An invalid row gains Adwaita's error style, exposes GTK's accessible invalid state, and can show the rule message as its tooltip. React Hook Form's `setFocus`, focus-on-first-error, `reset`, `resetField`, and `setValue` reach the GTK widget. Native event handlers still run after the form receives a real user edit, so an application can persist a switch immediately or submit an entry from its Apply button without taking ownership of the controlled value.

The [forms guide](/guide/forms) covers validation, disabled fields, custom controls, selection, and programmatic updates. The [tutorial task editor](/tutorial/the-task-editor) puts the adapter in a complete application with navigation and persisted state.

## The real react-i18next API, with gettext storage

`@gtkx/i18n` registers a real backend on the default `i18next` singleton and re-exports `react-i18next`. Existing component patterns remain the same: `useTranslation`, `withTranslation`, `Translation`, `Trans`, providers, SSR helpers, defaults, and context are the upstream implementations. The direct `t` and `init` exports use that same configured singleton.

The storage model follows the Linux desktop. Source messages become a gettext POT template, translators edit PO files, builds compile MO catalogs, and GLib performs the runtime lookup. Interpolation keeps i18next's `{{name}}` syntax, while an explicit singular and plural pair becomes one gettext plural entry:

```tsx
import { t, useTranslation } from "@gtkx/i18n";
import { AdwStatusPage } from "@gtkx/jsx/adw";

const SearchState = ({ query }: { query: string }) => {
    const { t } = useTranslation();

    return <AdwStatusPage description={t("No tasks match “{{query}}”", { query })} />;
};

const age = (count: number) => t("{{count}} day ago", "{{count}} days ago", { count });
```

Context and plural selection use gettext's own rules. The locale is process-wide, like the GLib and libc APIs underneath it, so an application selects its locale before startup rather than swapping an in-memory JSON resource store while it runs.

<picture>
  <source srcset="/tasks-i18n-fr.webp" type="image/webp" />
  <img src="/tasks-i18n-fr.png" width="900" height="600" loading="lazy" alt="The Tasks app running in French, with translated sidebar views, filters, search controls, and a no-results message interpolating the query introuvable." />
</picture>

*One French PO catalog drives the application UI and the metadata installed with it.*

## Strict messages, generated from the application

Translation keys often become strings that TypeScript cannot check. GTKX codegen instead follows `t` bindings through direct imports, hooks, HOCs, render callbacks, aliases, ESM, and CommonJS. It extracts each statically recoverable message and writes an application-specific declaration in `node_modules/.gtkx/i18n.d.ts`.

That declaration narrows literal keys and records their contract. TypeScript rejects an unknown literal, a missing or misspelled interpolation variable, a plural without a numeric `count`, and a contextual call without the matching literal context. The strict translator flows through direct `t`, `useTranslation`, `withTranslation`, and the `Translation` render callback; there is no registry for an application author to maintain.

Extraction is equally automatic. The project chooses locales in `po/LINGUAS` and translates their `msgstr` values. `gtkx codegen`, `gtkx dev`, and `gtkx build` generate `POTFILES.in`, refresh the POT, initialize missing PO files, merge source changes, and regenerate the TypeScript contract. Development and production builds also compile the catalogs they need. PO updates are staged and only replace existing catalogs after every locale succeeds, so one malformed catalog cannot leave the PO set half-updated.

## One localization lifecycle through deploy

`gtkx deploy` extends that same pass to the name, summary, descriptions, keywords, MIME descriptions, screenshot captions, and release notes in `gtkx.config.ts`. It validates and compiles the catalogs, writes localized desktop entries and AppStream XML, and stages the locale tree once for every target.

The generated launcher finds that tree relative to the installed application. Deb and RPM packages use `/usr/share/locale`, Flatpak uses `/app/share/locale`, and AppImage uses the image's runtime mount point. Source-mode Flatpak builds carry the same inputs. There is no format-specific locale path in application code and no second set of metadata translations.

The [internationalization tutorial](/tutorial/internationalization) takes the Tasks app from its first `t` call through a French integration test and localized Flatpak, deb, RPM, and AppImage artifacts. It deliberately starts from only `LINGUAS`; every mechanical catalog and packaging step is performed through the CLI.

## Also in 1.5

The MCP and test socket transports now reject malformed strings, cap incoming messages and queued writes, buffer messages split across read chunks, keep draining valid messages after a parse error, and fail promptly when the socket path is unwritable or a session bus hangs. Headless display startup reports compositor failures at their source instead of timing out later.

CSS rule insertion now drops rules containing raw newlines inside quoted values without corrupting later rules, while preserving escaped continuations and comments. The release also removes duplicated behavior code across React elements, components, CSS, settings, testing, MCP, and headless test infrastructure while retaining the observable APIs.

## Upgrading

GTKX 1.5 has no application-facing breaking changes. Upgrade the GTKX packages together, then install `@gtkx/forms` or `@gtkx/i18n` only in applications that use them:

```bash
npm install @gtkx/cli@^1.5.0 @gtkx/react@^1.5.0
npm install @gtkx/forms@^1.5.0 @gtkx/i18n@^1.5.0
```

Forms require generated `Adw-1` bindings. Internationalization requires GNU gettext command-line tools anywhere codegen, development, builds, or deploys run; installed applications consume the compiled catalog and do not need those authoring tools. Add `po/LINGUAS`, run the usual GTKX command, and let the generated template and catalogs become ordinary versioned project files.

## What's next

Forms and internationalization close the remaining application-scale items from the original public roadmap. The next priorities will come from real applications using the whole stack; the [project board](https://github.com/orgs/gtkx-org/projects/1) and [issue tracker](https://github.com/gtkx-org/gtkx/issues) are where that work is scoped.

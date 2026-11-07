---
title: "Internationalization"
description: "Translate GTKX applications and package metadata with gettext catalogs."
---

# Internationalization

`@gtkx/i18n` connects i18next and react-i18next to GNU gettext. Your application's production `applicationId` is its gettext domain, and the catalogs in `po/` translate both the application and its desktop metadata. GTKX manages `po/` only in projects that install `@gtkx/i18n`, so an existing gettext setup, such as a Meson project's, stays untouched until then.

Install `@gtkx/i18n@beta` and GNU gettext 0.25 or later. On Fedora 44:

```bash
npm install @gtkx/i18n@beta
sudo dnf install gettext
xgettext --version
msgfmt --version
```

Codegen, development and builds run the gettext tools (`xgettext`, `msginit`, `msgmerge`, `msgfmt` and others), so they must be on `PATH`. Some distributions package them separately, such as `gettext-tools` on openSUSE.

## Create a catalog

Add `po/LINGUAS` at the project root, with one locale per line:

```text
fr
```

Write source messages with `t`:

```tsx
import { t } from "@gtkx/i18n";
import { GtkLabel } from "@gtkx/jsx/gtk";

<GtkLabel label={t("Hello, {{name}}!", { name: profile.name })} />;
```

Run codegen:

```bash
gtkx codegen
```

GTKX creates the template `po/<applicationId>.pot`, a PO file for each listed locale, and translation types. Translators edit each catalog's `msgstr` values.

Run codegen again after changing messages. It updates the template and merges the changes into the catalogs. Review fuzzy entries before release; removed messages remain as obsolete entries.

When `msginit` has no plural rule for a locale, such as `ar` or `zh_CN`, its catalog starts with a placeholder `Plural-Forms` header. Replace it before translating plural messages.

Messages come from the `src` directory, or the project root without one, and from the workspace packages the application uses from source, as described in [Monorepos](/v2/guide/workspaces#monorepos). Their template locations are relative to the application, such as `../../packages/ui/src/rating.tsx:18`, and the application's catalogs translate them. Messages of packages installed from a registry are not extracted.

## Plurals and context

For a plural message, provide the singular and plural source strings through `defaultValue_one` and `defaultValue_other`:

```tsx
const label = t("{{count}} file", {
    count: files.length,
    defaultValue_one: "{{count}} file",
    defaultValue_other: "{{count}} files",
});
```

Gettext chooses the translated form using the catalog's plural rule. Counts must be non-negative safe integers. GTKX extraction requires both source forms and rejects i18next options that cannot be represented by this gettext entry, such as ordinal plurals and zero-specific defaults. Write both options out even when the English forms read the same, as in `{{count}} installed`: the message still gets a plural entry, and languages such as Italian translate it with two forms.

A `Trans` component takes the same options through `tOptions`, with the count in its `count` prop:

```tsx
<Trans
    i18nKey="{{count}} selected"
    count={selected.length}
    tOptions={{
        defaultValue_one: "{{count}} selected",
        defaultValue_other: "{{count}} selected",
    }}
/>
```

Use `context` when the same source text has different meanings:

```tsx
const command = t("Open", { context: "menu command" });
```

A missing contextual entry falls back to the ordinary message. A missing message uses its source text or `defaultValue`.

## Comments for translators

A comment that starts with `Translators:` right before a message reaches translators as an extracted comment (`#.`) in the template and in every catalog, as xgettext's `--add-comments=Translators:` does for Meson projects:

```tsx
// Translators: {{index}} is the number of the new recording.
const name = t("Recording {{index}}", { index });

<AdwAboutDialog
    // Translators: Replace this with your names, one per line.
    translatorCredits={t("translator-credits")}
/>;
```

- The comment belongs to the next `t` call or `Trans` element when only whitespace and other comments come between them, so it can sit on the lines above or earlier on the same line.
- Before an element in JSX children, write it as `{/* Translators: ... */}`.
- Code between the comment and the line of the call, such as `setTitle(` on a line of its own, detaches it.
- A comment goes only to the first message after it. A message used in several places collects the comment from each place.
- Comments without the tag stay out of the catalogs.

## Use translations in components

Import the React APIs from `@gtkx/i18n` so they use the configured gettext backend:

```tsx
import { useTranslation } from "@gtkx/i18n";
import { GtkLabel } from "@gtkx/jsx/gtk";

function Greeting({ name }: { name: string }) {
    const { t } = useTranslation();

    return <GtkLabel label={t("Hello, {{name}}!", { name })} />;
}
```

See [react-i18next's documentation](https://react.i18next.com/latest/usetranslation-hook) for its React APIs and [i18next's formatting guide](https://www.i18next.com/translation-function/formatting) for interpolation and formatting. GTKX supplies the catalog integration; gettext still uses one process-wide application domain.

## Keep messages extractable

Use ESM and the original names `t`, `useTranslation`, `Trans`, or `TransWithoutContext`. Keys, explicit `i18nKey` props, `context` and the `defaultValue` options must be string literals. Pass options as an inline object literal, without spreads or `as const`, and write `Trans` props out rather than spreading them: `t("Open", options)` fails extraction. A `Trans` component can derive its source from static children when `i18nKey` is omitted.

Extraction rejects aliases and member calls such as `i18n.t(...)`. CommonJS, tagged templates, and ICU MessageFormat are not extraction forms. These restrictions keep the catalog aligned with the calls that reach gettext.

Extraction follows `t` from its import or from a `useTranslation()` call in the same module. A `t` received in any other way, such as a function parameter, a prop, `withTranslation`, or the `Translation` render prop, is not extracted, and the generated declarations then reject its keys. Helpers outside components can import `t` from `@gtkx/i18n` instead, since gettext uses one language for the whole process.

[Storybook](/v2/guide/storybook) stories stay out of the catalogs. Files matched by the `stories` patterns in `.storybook/main.ts`, or by `src/**/*.stories.*` without that file, are left out of `po/POTFILES.in` and the template, so translators never see story fixture text. A `t` call in a story still type-checks and shows its source text, and the components a story renders show their translations as in the application.

Generated declarations under `node_modules/.gtkx` extend the upstream translation types. They check message keys and contexts, and the interpolation values of an options object. As in i18next, they do not require the options object itself or a plural message's `count`: `t("Hello, {{name}}!")` compiles and renders the placeholder unchanged. Run codegen after adding messages; do not edit the declarations.

## Develop and build

`gtkx dev` prepares the catalogs before loading your application. Saving source files updates the template and translation types before Fast Refresh without modifying PO files. Run codegen or a build to merge source changes into those files. Saving a PO file or `LINGUAS` restarts the application because gettext caches catalogs for the lifetime of the process.

A GNOME-style development profile gives the development build its own application ID, so it can run beside the installed app:

```ts [gtkx.config.ts]
import { defineConfig } from "@gtkx/config";

export default defineConfig({
    applicationId: "com.example.Tasks",
    $development: { applicationId: "com.example.Tasks.Devel" },
});
```

The gettext domain stays the production ID: `gtkx dev` registers `com.example.Tasks.Devel` but keeps using `po/com.example.Tasks.pot` and the same catalogs as tests, builds, and packages. A separate configuration selected with `--config` is a different project setup, so an application ID it changes also names its own template and domain.

`gtkx build` compiles the catalogs into `dist/locale` beside the bundle. When the entry module imports GTKX, directly or through other modules, the bundle initializes localization before the entry runs and finds that directory on its own.

Select the process locale before launch:

```bash
LANG=fr_FR.UTF-8 LANGUAGE=fr gtkx dev
```

Gettext translations follow the startup environment. Intl-based formatting uses the process's default locale. Changing i18next's language does not change libc's active gettext locale; restart the process to change the application's translation language.

## Text direction

GTK chooses the default text direction from the application's locale. Use `textDirection` on a widget when content needs an explicit direction, such as a left-to-right animation or technical value:

```tsx
import * as Gtk from "@gtkx/gi/gtk";
import { GtkLabel } from "@gtkx/jsx/gtk";

<GtkLabel textDirection={Gtk.TextDirection.LTR}>192.0.2.1</GtkLabel>;
```

Removing `textDirection`, passing `null`, or using `Gtk.TextDirection.NONE` restores GTK's default direction.

## Translate settings schemas

Codegen, development, and builds also extract the `<summary>` and `<description>` of every [GSettings schema](/v2/guide/native-state#your-app-s-schema) your application imports, as a Meson project does by listing the schema in `po/POTFILES.in`. xgettext reads them with the ITS rules GLib installs with its development files (`glib2-devel` on Fedora), so a `<!-- Translators: -->` comment before an element reaches translators as well. Existing translations of those messages stay in the PO files.

GLib translates the schema text shown by tools such as `gsettings describe` and dconf Editor from the domain named by the schema list's `gettext-domain` attribute. Set it to your production `applicationId`, the application's gettext domain:

```xml [data/com.example.Tasks.gschema.xml]
<schemalist gettext-domain="com.example.Tasks">
    <schema id="com.example.Tasks" path="/com/example/Tasks/">
        <key name="show-completed" type="b">
            <default>true</default>
            <summary>Show completed tasks</summary>
        </key>
    </schema>
</schemalist>
```

Without `gettext-domain`, those tools show the source text. Installed packages put the catalogs where GLib looks for that domain, so the summaries translate once the application is installed.

## Translate package metadata

A normal `gtkx deploy` refreshes the catalog with application and metadata messages, then compiles and packages the translations. The same PO files supply desktop-entry names, AppStream text, and MIME descriptions. The AppStream metainfo also names the application's gettext domain, so AppStream catalog generators, including Flathub's, can list the languages the application is translated into.

[`gtkx deploy --skip-build`](/v2/guide/cli#gtkx-deploy) packages the existing build and recompiles existing catalogs without updating PO files. Every locale in `LINGUAS` must already have a catalog. Packaged launchers locate the installed catalogs automatically.

See [Deploying](/v2/guide/deploying) for the packaging workflow.

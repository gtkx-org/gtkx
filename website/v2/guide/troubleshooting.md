---
title: "Troubleshooting"
description: "Fix common problems creating, generating, running, refreshing, and updating a GTKX app."
---

# Troubleshooting

Each heading names a symptom. For errors your app reports at runtime, see [Error Handling](/v2/guide/error-handling).

## The create command runs an older scaffolder {#the-create-command-finds-no-version}

On the day of a GTKX release, a package manager's release-age gate holds back the new `create-gtkx`, and the create command quietly runs an older one. pnpm 11 and newer gate by default and run the previous release. npm gates only when `min-release-age` is set, and then runs the newest stable release: during the 2.0 beta, that is the 1.x scaffolder, which creates a GTKX 1.x project. Yarn 4.15 and newer gate by default and stop instead, reporting that every version of a `@gtkx` dependency is quarantined. The scaffolder exempts GTKX's own packages in the project it creates (see [Scaffold Options](/v2/guide/scaffold-options#release-age-gates)), but the gate still applies to downloading the scaffolder.

Exempt GTKX for that one command. npm ignores `min-release-age-exclude` when it downloads the scaffolder, so lift its gate for the download with `--min-release-age=0`; the scaffolder's own install still applies the gate:

```bash
pnpm_config_minimum_release_age_exclude='["@gtkx/*","create-gtkx"]' \
    pnpm create gtkx@beta
npm create --min-release-age=0 gtkx@beta
YARN_NPM_PREAPPROVED_PACKAGES='@gtkx/*,create-gtkx' \
    yarn create gtkx@beta
```

## Dependency installation fails while scaffolding

The generated files remain in the project directory, but the scaffolder stops before initializing Git. Resolve the package manager's error, rerun its install command there, and run `git init` if you want the project under version control.

When the app was added to an existing [workspace](/v2/guide/scaffold-options#workspaces), the command first prints the root settings the app needs. Add them to the workspace root before installing again.

## Missing GIR file

Codegen reports `GIR file Adw-1.gir not found on girPath`, or that no GIR search paths are available. Install the library's development package, which supplies its GIR file, then run `npx gtkx codegen` from the project. For libraries outside the standard directories, set [`girPath`](/v2/guide/configuration-and-codegen#the-config-file).

## Native versions are too old

A call fails with `Failed to find symbol '…'`, or the generated bindings lack a widget, property or method that the docs use. Compare `pkg-config --modversion gtk4 libadwaita-1` with the [minimum versions](/v2/guide/getting-started#what-you-need), and use a distribution or development container that meets them. Installing newer npm packages does not upgrade GTK or libadwaita.

## No display connection

GTK prints `Failed to open display` and the app exits. Run the app from a terminal in a graphical desktop session. In a development container, give the container access to the session's display and D-Bus; installing the libraries alone does not provide that connection. Tests run without a desktop and have a separate [headless setup](/v2/guide/testing#setup).

## The app restarts instead of refreshing

`gtkx dev` applies most edits to the open window with Fast Refresh and keeps its state:

- Editing a module that exports only components refreshes it in place.
- Editing any other module, such as a custom hook or shared styles, refreshes the component modules that import it, directly or through other modules.
- A component whose hook calls change remounts, which resets its state and the state of the components inside it.
- Editing an imported stylesheet replaces its rules. Editing a module's `injectGlobal` rules adds the edited rules, while the earlier ones stay until the app restarts.

These changes restart the app and reset its state. The terminal usually names the cause first, such as `Module imports changed: <path>`.

- an edit that reaches the entry module before a component module
- importing or re-exporting a module that the edited module did not import before, or no longer importing one; adding a name to an existing import, or editing type-only imports, refreshes instead
- an edit to an imported resource, icon or settings schema, a new `?font` import, or an edit to a file a [worker](/v2/guide/workers) loaded
- removing a module or stylesheet the app loaded
- an edit that changes a construct-only prop, such as the `strings` of a `GtkStringList`
- an edit to `gtkx.config.ts` or a file it loads, an [environment file](/v2/guide/configuration-and-codegen#environment-files), or a GIR file the bindings were generated from
- a saved PO file or `LINGUAS` ([Internationalization](/v2/guide/internationalization#develop-and-build))
- a lockfile change from installing or updating dependencies
- any other change that Fast Refresh cannot patch

## A new GTKX release does not install

A project created by `create-gtkx` 2.0.0-beta.12 or earlier has no release-age exemption for GTKX, so on the day of a release its package manager's gate holds back the new packages. [`gtkx upgrade`](/v2/guide/updating) adds the exemption before installing. To install on a release day without upgrading, add the [entries](/v2/guide/scaffold-options#release-age-gates) yourself, or install again a day later.

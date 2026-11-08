---
title: "Workspaces"
description: "Run GTKX apps in pnpm, npm and Yarn workspaces, and build, test and publish component libraries."
---

# Workspaces

A workspace holds several GTKX apps and the packages of components they share. This page covers how they share generated bindings and sources, and how to package components as a library that apps install. Each app's own settings are described in [Configuration and Codegen](/v2/guide/configuration-and-codegen).

## Monorepos

GTKX apps and shared packages of components work in pnpm and npm workspaces with the package manager's default `node_modules` layout, and in Yarn workspaces whose root `.yarnrc.yml` sets `nodeLinker: node-modules`. Scaffolding into a directory the workspace lists, as in `pnpm create gtkx@beta apps/my-app`, adds the app to the workspace and prints the settings the root needs; see [Scaffold Options](/v2/guide/scaffold-options#workspaces).

Codegen writes the bindings into the `node_modules` directory the GTKX packages are installed in. In a workspace this is usually the root: pnpm keeps every package under the root `node_modules/.pnpm`, and npm and Yarn hoist them there. The bindings link `@gtkx/runtime`, `@gtkx/cairo`, `@gtkx/react`, `react` and `@types/react` from the app, so they use the same copies the app does.

Apps that resolve the same directory share one set of bindings, generated for the union of their `libraries`. Codegen stops with an error naming the other app when apps sharing bindings differ in anything else:

- `girPath` or `elements`
- whether they use `@gtkx/react`
- a version of a GIR namespace, such as `Soup-2.4` and `Soup-3.0`
- the copies of `@gtkx/runtime`, `@gtkx/cairo`, `@gtkx/react`, `react` or `@types/react` they resolve

Keep these aligned across the workspace, for example with a [pnpm catalog](https://pnpm.io/catalogs). After changing `girPath` or `elements` in every app, run [`gtkx codegen --force`](/v2/guide/cli#gtkx-codegen) in one of them; the others share its bindings again the next time they generate theirs.

Each app still imports only the libraries it declares and their dependencies, which are also what `gtkx deploy` requires of the installed system. Codegen gives an app that shares bindings its own `@gtkx/gi` and `@gtkx/jsx` packages, which expose those namespaces and link them to the shared bindings. They live in the app's `node_modules/.gtkx`, as a single project's bindings do, so the scaffold's `tsconfig.json` paths and editors keep finding them after any package install. An app at the workspace root, where the bindings are written, sees every namespace.

Importing a namespace that only another app declared fails:

- in `gtkx dev`, `gtkx build` and Vitest, with an error naming the library to add to `libraries`
- in Node, which reports the subpath as not exported
- in `tsc`, which reports the namespace as having no exports

A shared package declares `@gtkx/react` as a peer dependency and imports `@gtkx/gi` and `@gtkx/jsx` subpaths like an app. List it in the dependencies of each app that uses it, so `gtkx dev` loads it through Vite. A shared package resolves the bindings from the workspace root, so it can import any library some app declares; each app that uses it has to declare the libraries the package imports.

GTKX treats the sources of the workspace packages an app uses as part of the app. These are the packages that depend on `@gtkx/react` or `@gtkx/i18n` and that the app's dependencies, directly or through other such packages, link from outside `node_modules`: workspace packages and `link:` or `file:` directories. Codegen, `gtkx dev`, `gtkx build` and `gtkx deploy` read their `src` directories as they read the app's:

- Their [messages](/v2/guide/internationalization) go into the app's gettext template, `po/POTFILES.in` and translation types, at locations relative to the app such as `../../packages/ui/src/rating.tsx:18`, so the app's catalogs translate them. Their stories stay out of the catalogs.
- Their `?icon=<name>` and `?resource=<path>` [imports](/v2/guide/assets) and the GSettings schemas they import are declared in the app's `node_modules/.gtkx/env.d.ts`, so the app's `tsc` accepts them. The app bundles and installs those schemas, and `gtkx deploy` requires a schema's file name to start with the app's ID, as for the app's own.
- Saving one of their files in `gtkx dev` updates the app's template and declarations, as saving one of the app's does.

Packages installed from a registry stay outside: their messages are not extracted, so a published [component library](#component-libraries) takes translated text from the app, for example as props.

An app's [Storybook](/v2/guide/storybook#stories-from-a-shared-package) configuration can list a shared package's stories with a pattern such as `../../packages/ui/src/**/*.stories.tsx`. A shared package can also run its own tests and Storybook explorer without an `applicationId`, as a [component library](#component-libraries) does.

## Component libraries

A component library is a package of GTKX components that apps install, from their workspace or from a registry. It is not an application, so it has no `applicationId`. It needs a `gtkx.config.ts` only to list the GIR libraries its components import beyond Adwaita and GTK:

```ts [gtkx.config.ts]
import { defineConfig } from "@gtkx/config";

export default defineConfig({
    libraries: ["GtkSource-5"],
});
```

`gtkx codegen`, `gtkx storybook` and the Vitest plugin work in such a package, with or without the file, while `gtkx dev`, `gtkx build` and `gtkx deploy` stop because they need an `applicationId`. Codegen writes no `AGENTS.md`, `CLAUDE.md` or `.gtkx/reference` there unless `agents.rules` or `agents.reference` is `true`.

Its `package.json` lists `@gtkx/react` and `react` as peer dependencies, with any other GTKX package its components import at runtime, such as `@gtkx/css` or `@gtkx/cairo`, so that it uses the app's copies. It does not depend on `@gtkx/gi` or `@gtkx/jsx`: each app generates those for the libraries it declares, so an app that uses the package lists in `libraries` every GIR library the package imports beyond Adwaita and GTK.

For building and testing, add the peer packages, `@gtkx/cairo`, `@gtkx/cli`, `@gtkx/config`, `@gtkx/runtime`, `@gtkx/testing`, `@types/node`, `@types/react`, `typescript` and `vitest` as development dependencies. The generated bindings import the package's own `@gtkx/runtime` and `@gtkx/cairo`, so where the package manager does not hoist them, as pnpm does not, `gtkx codegen` stops with "Cannot resolve @gtkx/runtime" without the first and the tests fail with "Cannot find package '@gtkx/cairo'" without the second.

```json [package.json]
{
    "name": "@example/ui",
    "version": "0.1.0",
    "type": "module",
    "exports": {
        ".": {
            "types": "./dist/index.d.ts",
            "default": "./dist/index.js"
        }
    },
    "files": ["dist"],
    "scripts": {
        "build": "gtkx codegen && tsc -p tsconfig.build.json",
        "typecheck": "gtkx codegen && tsc",
        "test": "vitest run"
    }
}
```

Build it with `tsc` into JavaScript and declarations. Start from a scaffolded app's `tsconfig.json`, which resolves `@gtkx/gi` and `@gtkx/jsx` to the generated bindings, and copy its `src/gtkx-env.d.ts`, which types `import.meta.env` and asset imports such as `?icon`. Then add a build configuration that emits only the sources:

```json [tsconfig.build.json]
{
    "extends": "./tsconfig.json",
    "compilerOptions": {
        "noEmit": false,
        "declaration": true,
        "outDir": "dist",
        "rootDir": "src"
    },
    "include": ["src/**/*"],
    "exclude": ["src/**/*.stories.tsx"]
}
```

The output keeps its `@gtkx/gi` and `@gtkx/jsx` imports, in the JavaScript and in the declarations, so the app's own bindings resolve them when it builds and typechecks. `gtkx dev`, `gtkx build` and the Vitest plugin load an installed package that depends on `@gtkx/react` through Vite, so the app needs no extra configuration, and `gtkx build` bundles the package and lists it in `BUNDLED-NOTICES`. Publish the package with your package manager after building it, for example `npm publish`.

Test the components with `@gtkx/testing` and the Vitest plugin, as in an app:

```ts [vitest.config.ts]
import gtkx from "@gtkx/cli/vitest-plugin";
import { defineConfig } from "vitest/config";

export default defineConfig({
    plugins: [gtkx()],
});
```

The tests run as the application `org.gtkx.Test`. To browse the components in the [Storybook explorer](/v2/guide/storybook), also add `@gtkx/storybook` as a development dependency and run `gtkx storybook`; the explorer registers as `org.gtkx.Library.Storybook`. In a workspace the package shares the bindings of the apps around it, under the rules described in [Monorepos](#monorepos).

# hello-world

The smallest complete GTKX app: a window with a heading, a counter, and an Increment button. This is the example shown in the [project README](../../README.md).

## What it demonstrates

- `createRoot().render()` in `index.tsx`, with the component tree in `app.tsx`.
- `GtkApplication` and `GtkApplicationWindow` written as JSX, using the intrinsic elements generated into `@gtkx/jsx/gtk`.
- Ordinary React state: `useState` drives the text of a `GtkLabel`.
- Signals as props: `onClicked` on `GtkButton`, `onCloseRequest` on the window.
- Widget properties as props, including `cssClasses` for the Adwaita style classes `title-1`, `title-2`, `suggested-action`, and `pill`.
- Imperative values from `@gtkx/gi/gtk`, such as `Gtk.Orientation.VERTICAL` and `Gtk.Align.CENTER`.

`gtkx.config.ts` needs only the application ID; GTK and Adwaita are bound by default.

## Run it

Install and build the workspace once from the repository root, then:

```sh
pnpm --filter hello-world dev
```

`gtkx dev` starts the dev server with Fast Refresh: edit `src/app.tsx` and the running window updates in place. `pnpm --filter hello-world build` writes `dist/bundle.mjs`, which `pnpm --filter hello-world start` runs with Node.js.

## Learn more

- [Getting Started](https://gtkx.dev/guide/getting-started)
- [Components](https://gtkx.dev/guide/components)

# browser

A compact web browser. An Adwaita window wraps a `WebKitWebView`, with back, forward, and reload/stop buttons, a URL entry in the header bar, and a progress bar that hides when a page finishes loading. It opens [gtkx.dev](https://gtkx.dev).

## What it demonstrates

- Binding a third-party GObject-Introspection library: adding `WebKit-6.0` to `libraries` in `gtkx.config.ts` provides `WebKitWebView` as an intrinsic element from `@gtkx/jsx/webkit` and the `WebKit` namespace from `@gtkx/gi/webkit`, both fully typed.
- Adwaita layout with `AdwToolbarView` and `AdwHeaderBar`, including the `topBar`, `titleWidget`, and `start` widget props.
- A `ref` to the live `WebKit.WebView` for imperative calls that do not belong in state: `loadUri`, `goBack`, `goForward`, `reload`, and `stopLoading`.
- Signals and property notifications as props: `onLoadChanged` reads `canGoBack()` and `getUri()` off the emitter, and `onNotifyEstimatedLoadProgress` tracks load progress.
- CSS-in-JS with `@gtkx/css`: the `css` tagged template returns a class name passed through `cssClasses`.
- A controlled `GtkEntry`, driven by `onChanged` and committed on `onActivate`.

`gtkx.config.ts` declares `Gtk-4.0`, `Adw-1`, and `WebKit-6.0`, with the application ID `com.gtkx.browser`. The WebKitGTK 6 development package must be installed; see [CONTRIBUTING.md](../../CONTRIBUTING.md#system-dependencies).

## Run it

Install and build the workspace once from the repository root, then:

```sh
pnpm --filter browser dev
```

`pnpm --filter browser build` writes `dist/bundle.mjs`, which `pnpm --filter browser start` runs with Node.js.

## Learn more

- [Configuration and Codegen](https://gtkx.dev/guide/configuration-and-codegen)
- [Components](https://gtkx.dev/guide/components)
- [CSS](https://gtkx.dev/guide/css)

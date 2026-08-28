---
description: "Put an Adwaita window with a header bar on screen, and learn what mounted it."
---

# Your First Window

You have a scaffolded project that runs. Replace its contents with the first piece of Tasks: an application, a window, and a header bar. If you skipped ahead, start at [the introduction](/tutorial/) and come back once `npm create gtkx` has finished.

## What the scaffolder made

Open the `tasks` directory. The files the scaffolder wrote, alongside the `node_modules` it installed and the `.git` repository it initialized:

```
tasks/
├── src/
│   ├── app.tsx
│   ├── gtkx-env.d.ts
│   └── index.tsx
├── tests/
│   └── app.test.tsx
├── .gitignore
├── gtkx.config.ts
├── package.json
├── tsconfig.json
└── vitest.config.ts
```

`gtkx.config.ts` declares your application ID and the libraries codegen generates bindings for. `src/index.tsx` mounts the component tree. `src/app.tsx` is the file you work in; it holds the counter demo you are about to delete. `src/gtkx-env.d.ts` points TypeScript at the generated bindings, so every widget you write is typed without importing a type.

`gtkx.config.ts`:

```ts
import { defineConfig } from "@gtkx/config";

export default defineConfig({
    applicationId: "com.gtkx.tutorial",
    applicationIcon: "data/icons",
    future: {
        v2ByteArrays: true,
        v2ValueReturns: true,
        v2FinishResults: true,
        v2InoutReturns: true,
        v2ResourceImports: true,
        v2DefaultLibraries: true,
    },
});
```

Everything on this page comes from Adwaita rather than plain GTK4, and there is nothing to add for it: `v2DefaultLibraries` binds `Gtk-4.0` and `Adw-1` together, so `libraries` is only for what you want on top of them. A project that needed WebKit would name it there and nothing else.

If your application ID reads something else, change it to `com.gtkx.tutorial` now: the schema file, the notification identity, and the Flatpak all key off this string.

## The entry point

`src/index.tsx` stays as it is for the rest of the tutorial.

`src/index.tsx`:

```tsx
import { createRoot } from "@gtkx/react";
import { App } from "./app.js";

createRoot().render(<App />);
```

`createRoot()` gives you a React root backed by the GTKX reconciler. It is to GTK4 what React DOM is to the browser: it creates, updates, and destroys real GObject instances to match the tree your components return. With no argument it targets the process-level root, where an application element belongs.

## The application and its window

Replace the whole of `src/app.tsx` with this. The scaffolder's `tests/app.test.tsx` covers the counter you are deleting, so delete that file along with it: [Appendix A](/tutorial/testing) writes the tests for Tasks from scratch. Leaving it there breaks `npm run typecheck` and `npm test` from here on, because it imports `App` as a default export and the file below has none.

`src/app.tsx`:

```tsx
import { AdwApplication, AdwApplicationWindow } from "@gtkx/jsx/adw";
import { quit } from "@gtkx/react";

export function App() {
    return (
        <AdwApplication>
            <AdwApplicationWindow
                title="Tasks"
                widthRequest={360}
                heightRequest={294}
                onCloseRequest={() => quit()}
            />
        </AdwApplication>
    );
}
```

One rule covers both elements and the rest of the tutorial: **a component's name is the GObject type name, verbatim**. `AdwApplicationWindow` is the widget `AdwApplicationWindow`; `GtkListBox` is `GtkListBox`. Anything in the [GTK4](https://docs.gtk.org/gtk4/) or [Adwaita](https://gnome.pages.gitlab.gnome.org/libadwaita/doc/) documentation is already a component. There is no wrapper to write and no list of supported widgets to check.

Props follow the same rule: they are the widget's GObject properties, camelCased, so `width-request` becomes `widthRequest`. Signals get the `on` prefix and PascalCase, so `close-request` becomes `onCloseRequest`. Here it calls `quit()` to end the process when you close the last window.

`AdwApplication` starts the `Gtk.Application` when it mounts, taking its application ID from `gtkx.config.ts`. `AdwApplicationWindow` presents itself when it mounts and destroys itself when it unmounts: rendering a window opens it, removing it from the tree closes it. You never call `present()` anywhere in this app.

360 by 294 is the GNOME phone form factor, the smallest size a GNOME application is expected to handle. Committing to it now keeps the adaptive layout you build in [A Layout That Collapses](/tutorial/an-adaptive-layout) honest: any layout that stops working at that width fails while you are looking at it.

## Giving the window a header bar

An `AdwApplicationWindow` is freeform: its content area runs edge to edge with no titlebar, so nothing on screen shows the title you set and there is nothing to drag or close the window with. `AdwToolbarView` supplies that furniture: it holds your content and stacks bars above and below it.

`src/app.tsx`:

```tsx
import {
    AdwApplication,
    AdwApplicationWindow,
    AdwHeaderBar,
    AdwStatusPage,
    AdwToolbarView,
} from "@gtkx/jsx/adw";
import { quit } from "@gtkx/react";

export function App() {
    return (
        <AdwApplication>
            <AdwApplicationWindow
                title="Tasks"
                widthRequest={360}
                heightRequest={294}
                onCloseRequest={() => quit()}
            >
                <AdwToolbarView topBar={<AdwHeaderBar />}>
                    <AdwStatusPage
                        iconName="checkbox-checked-symbolic"
                        title="No Tasks Yet"
                        description="Your tasks will show up here."
                    />
                </AdwToolbarView>
            </AdwApplicationWindow>
        </AdwApplication>
    );
}
```

`topBar` takes JSX, which is the other rule to carry forward: **some props are container slots rather than values**. A widget with more than one place to put a child exposes each place as its own prop, filled with an element just as you would fill `children`. Props like `sidebar`, `content`, `prefix`, and `suffix` all work this way.

The empty `AdwHeaderBar` picks up the window's `title` on its own and draws the window controls. `AdwStatusPage` is the standard Adwaita empty state: an icon, a title, and a line of explanation, centered in whatever space it is given.

## Run it

Save `src/app.tsx` and look at the window that has been open since the introduction. The counter is replaced by a window 360 points wide at its narrowest, titled **Tasks** in a header bar, with a checkbox icon centered above the words **No Tasks Yet**.

Now change one string: set the status page title to `Nothing Here Yet` and save. The text in the open window changes. The window did not reopen, the process did not restart, and nothing flashed, because Fast Refresh patched the running widget tree in place. This is the loop you work in for the rest of the tutorial.

Set the title back to `No Tasks Yet` before moving on.

## Next

Continue to [Showing a List of Tasks](/tutorial/a-list-of-tasks).

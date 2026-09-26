---
description: "Build the Tasks application shell with an Adwaita window and header bar."
---

# Create a Window

You have a project that runs. For the complete v2 tutorial, use the [repository setup](/v2/tutorial/#use-the-repository-build); published beta.10 supports this chapter but not all later APIs. Replace its contents with the first piece of Tasks: an application, a window, and a header bar. If you skipped ahead, start at [the introduction](/v2/tutorial/) and come back once `npm create gtkx@beta` has finished.

## What the scaffolder made

`gtkx.config.ts` configures the application and generated bindings. `src/index.tsx` mounts the component tree, and `src/app.tsx` contains the counter demo you will replace. `src/gtkx-env.d.ts` connects TypeScript to the generated declarations.

`gtkx.config.ts`:

```ts [gtkx.config.ts]
import { defineConfig } from "@gtkx/config";

export default defineConfig({
    applicationId: "com.gtkx.tutorial",
    applicationIcon: "data/icons",
});
```

GTKX generates Adwaita and GTK4 bindings by default. The `libraries` option lists additional native libraries; see [Configuration and Codegen](/v2/guide/configuration-and-codegen).

Keep the application ID you chose in the introduction, and use it wherever later examples show `com.gtkx.tutorial`.

## The entry point

`src/index.tsx` stays as it is for the rest of the tutorial.

`src/index.tsx`:

```tsx [src/index.tsx]
import { createRoot } from "@gtkx/react";
import { App } from "./app.js";

createRoot().render(<App />);
```

`createRoot()` creates the React root for the native application. GTKX creates and updates GObject instances from the JSX tree. With no argument, the root accepts the application element shown below.

## The application and its window

Replace `src/app.tsx` with the following. Also remove the scaffolder's `tests/app.test.tsx`, which tests the counter and imports its default export. [Add Tasks](/v2/tutorial/the-task-store#test-the-entry-row) adds the first tests for Tasks.

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

Generated JSX elements use their GObject type names: `AdwApplicationWindow`, `GtkListBox`, and so on. The available elements come from your project's configured GIR libraries. Use the [generated element reference](/v2/guide/configuration-and-codegen#generating-element-reference-docs) for their props and signals.

GObject properties become camelCase props, such as `widthRequest`. Signals become handlers such as `onCloseRequest`; here, closing the window calls `quit()` to unmount the application.

`AdwApplication` takes its application ID from `gtkx.config.ts` and starts the application when it mounts. Rendering `AdwApplicationWindow` opens the window; removing it from the tree closes it.

The minimum size keeps narrow-window testing available as you add [Adapt the Layout](/v2/tutorial/an-adaptive-layout).

## Giving the window a header bar

`AdwApplicationWindow` leaves its content area free for your layout. Add `AdwToolbarView` with an `AdwHeaderBar` to show the title and window controls above the content.

`src/app.tsx`:

```tsx [src/app.tsx]
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

`topBar` is a JSX slot for the header bar. The status page goes in `children`, the toolbar view's content slot. GTKX uses named slots where a native container has several places for children; see [the JSX prop model](/v2/guide/configuration-and-codegen#the-jsx-prop-model).

The header bar picks up the window title. `AdwStatusPage` supplies the empty state until the next chapter adds tasks.

## Run it

Save `src/app.tsx` and look at the window that has been open since the introduction. The counter is replaced by a window 360 logical pixels wide at its narrowest, titled **Tasks** in a header bar, with a checkbox icon centered above the words **No Tasks Yet**.

Change the status page title to `Nothing Here Yet` and save. Fast Refresh updates the text in the open window.

Set the title back to `No Tasks Yet` before moving on.

## Next

Continue to [Display Tasks](/v2/tutorial/a-list-of-tasks).

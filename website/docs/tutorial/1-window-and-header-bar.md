# 1. Window & header bar

In this tutorial, you'll build a fully-featured Notes application from scratch. Each chapter introduces new GTKX concepts by adding functionality to the app. By the end, you'll have a polished, deployable desktop application.

![Notes app after this chapter](./images/1-window-and-header-bar.png)

## Create the project

Start by scaffolding a new project:

```bash
npx @gtkx/cli@latest create notes-app
```

Choose your preferred package manager and enable testing when prompted.

## The entry point

A GTKX app starts in `src/index.tsx`, which renders the root component. `render` takes a single argument — the element tree:

```tsx
import { render } from "@gtkx/react";
import { App } from "./app.js";

render(<App />);
```

The `<App />` tree owns the GTK application. The `<AdwApplication>` component creates, registers, and activates the application for you, then publishes it through context so hooks like `useApplication` can read it. You never construct an `Adw.Application` or `Gtk.Application` yourself, and you never pass one to `render`.

## The application window

Replace the generated `src/app.tsx` with an Adwaita-styled window wrapped in `<AdwApplication>`:

```tsx
import {
    AdwApplication,
    AdwApplicationWindow,
    AdwHeaderBar,
    AdwStatusPage,
    AdwToolbarView,
} from "@gtkx/jsx/adw";
import { quit } from "@gtkx/react";

function NotesWindow() {
    return (
        <AdwApplicationWindow
            title="Notes"
            defaultWidth={600}
            defaultHeight={500}
            onCloseRequest={() => {
                quit();
                return true;
            }}
        >
            <AdwToolbarView addTopBar={<AdwHeaderBar />}>
                <AdwStatusPage
                    vexpand
                    iconName="document-edit-symbolic"
                    title="No Notes Yet"
                    description="Press + to create your first note"
                />
            </AdwToolbarView>
        </AdwApplicationWindow>
    );
}

export function App() {
    return (
        <AdwApplication applicationId="com.example.notes">
            <NotesWindow />
        </AdwApplication>
    );
}
```

The window lives inside `<AdwApplication>`. Every later chapter keeps this structure: the inner `NotesWindow` component grows, while the `<AdwApplication>` wrapper stays exactly as shown here.

The `onCloseRequest` handler runs when the user clicks the window's close button. Returning `true` vetoes GTK's native close so your React code controls what happens — here it calls `quit()` to shut the application down. The same pattern drives secondary windows from state: set the state to `false` and return `true`, and React unmounts the window.

### Status pages

`AdwStatusPage` is the standard GNOME pattern for empty states and placeholder views. It displays a centered icon, title, and description — use it instead of manual label layouts.

### Slot props

Notice the `addTopBar` prop on `<AdwToolbarView>` — this is a **slot prop**. Instead of imperatively calling `toolbar.addTopBar(headerBar)`, you pass the widget through a JSX prop that accepts a React element. Slot props are auto-generated from GIR metadata and follow the pattern `parentMethodName={<Widget />}`.

```tsx
<AdwHeaderBar titleWidget={<GtkLabel label="Notes" cssClasses={["heading"]} />} />
```

The `titleWidget` prop replaces the default title text with a custom widget. Other common slot props include `popover`, `startChild`, `endChild`, and `content`.

Common slot props you'll see throughout this tutorial:

| Prop | Purpose |
|-----------|---------|
| `AdwToolbarView` `addTopBar` | Add a widget to the top bar area |
| `AdwToolbarView` `addBottomBar` | Add a widget to the bottom bar area |
| `GtkHeaderBar` `packStart` | Pack a widget at the start of a header bar |
| `GtkHeaderBar` `packEnd` | Pack a widget at the end of a header bar |

## Adding header bar buttons

Add a "New Note" button to the header bar:

```tsx
import {
    AdwApplication,
    AdwApplicationWindow,
    AdwHeaderBar,
    AdwStatusPage,
    AdwToolbarView,
} from "@gtkx/jsx/adw";
import { GtkButton } from "@gtkx/jsx/gtk";
import { quit } from "@gtkx/react";

function NotesWindow() {
    return (
        <AdwApplicationWindow
            title="Notes"
            defaultWidth={600}
            defaultHeight={500}
            onCloseRequest={() => {
                quit();
                return true;
            }}
        >
            <AdwToolbarView
                addTopBar={
                    <AdwHeaderBar
                        packStart={
                            <GtkButton
                                iconName="list-add-symbolic"
                                tooltipText="New Note"
                                onClicked={() => console.log("New note!")}
                            />
                        }
                    />
                }
            >
                <AdwStatusPage
                    vexpand
                    iconName="document-edit-symbolic"
                    title="No Notes Yet"
                    description="Press + to create your first note"
                />
            </AdwToolbarView>
        </AdwApplicationWindow>
    );
}

export function App() {
    return (
        <AdwApplication applicationId="com.example.notes">
            <NotesWindow />
        </AdwApplication>
    );
}
```

::: tip Tooltips
The GNOME HIG requires tooltips on all header bar controls. Always set `tooltipText` on buttons in the header bar so users can discover their function on hover.
:::

Run `npm run dev` to see your app with a header bar and a "+" button.

## Next

In the [next chapter](./2-styling.md), you'll style the notes list with CSS-in-JS.

# 1. Window & Header Bar

In this tutorial, you'll build a fully-featured Notes application from scratch. Each chapter introduces new GTKX concepts by adding functionality to the app. By the end, you'll have a polished, deployable desktop application.

![Notes app after this chapter](./images/1-window-and-header-bar.png)

## Create the Project

Start by scaffolding a new project:

```bash
npx @gtkx/cli@latest create notes-app
```

Choose your preferred package manager and enable testing when prompted.

## The Application Window

Replace the generated `src/app.tsx` with an Adwaita-styled window:

```tsx
import { AdwApplicationWindow, AdwHeaderBar, AdwStatusPage, AdwToolbarView, quit } from "@gtkx/react";

export default function App() {
    return (
        <AdwApplicationWindow title="Notes" defaultWidth={600} defaultHeight={500} onClose={quit}>
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
```

### Status Pages

`AdwStatusPage` is the standard GNOME pattern for empty states and placeholder views. It displays a centered icon, title, and description — use it instead of manual label layouts.

### Slot Props

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

## Adding Header Bar Buttons

Add a "New Note" button to the header bar:

```tsx
import {
    AdwApplicationWindow,
    AdwHeaderBar,
    AdwStatusPage,
    AdwToolbarView,
    GtkButton,
    quit,
} from "@gtkx/react";

export default function App() {
    return (
        <AdwApplicationWindow title="Notes" defaultWidth={600} defaultHeight={500} onClose={quit}>
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
```

::: tip Tooltips
The GNOME HIG requires tooltips on all header bar controls. Always set `tooltipText` on buttons in the header bar so users can discover their function on hover.
:::

Run `npm run dev` to see your app with a header bar and a "+" button.

## Next

In the [next chapter](./2-styling.md), you'll style the notes list with CSS-in-JS.

# Thinking in GTKX

GTKX renders React components to native GTK4 widgets. If you know React, you already know most of GTKX: components, hooks, state, and context work exactly as they do everywhere else. What changes is the host. This page walks through the places where GTK's model differs from the browser's and the beginner mistakes each difference invites.

## It's React, not React DOM

GTKX is a custom React renderer. The component model is unchanged — `useState`, `useEffect`, context, refs, and composition all behave as in any React app. But there is no DOM, no HTML, and no browser CSS engine. Your JSX produces real GObject widgets, so there is no `<div>` or `<span>`; host elements are GTK widget classes.

Element components are imported as constants from `@gtkx/jsx/<ns>` — `@gtkx/jsx/gtk` for GTK widgets, `@gtkx/jsx/adw` for Adwaita, `@gtkx/jsx/gio` for menus and actions. They accept props that map to GTK properties, signals, and child widgets:

```tsx
import { GtkButton } from "@gtkx/jsx/gtk";
import { useState } from "react";

const Counter = () => {
    const [count, setCount] = useState(0);
    return <GtkButton label={`Clicked ${count} times`} onClicked={() => setCount((c) => c + 1)} />;
};
```

Input arrives through GTK signals and event controllers instead of synthetic DOM events, and styling goes through GTK's own CSS dialect — see [Styling](/docs/styling).

## Widgets, props, and signals

Props map to GObject properties, written in camelCase: `placeholderText` sets GTK's `placeholder-text`, `defaultWidth` sets `default-width`. Setting a prop updates the property; removing it resets the widget.

`onX` props connect signal handlers: `onClicked` connects the `clicked` signal, `onChanged` connects `changed`. Handlers receive the signal's arguments followed by the emitting widget itself as the last argument. Property change notifications get their own props — `onNotifyText` fires whenever the `text` property changes, no matter what changed it.

```tsx
import { GtkBox, GtkButton, GtkEntry } from "@gtkx/jsx/gtk";
import { useState } from "react";

const Greeter = () => {
    const [name, setName] = useState("");

    return (
        <GtkBox spacing={8}>
            <GtkEntry placeholderText="Your name" onChanged={(entry) => setName(entry.text ?? "")} />
            <GtkButton label="Greet" sensitive={name.length > 0} onClicked={() => console.log(`Hello, ${name}!`)} />
        </GtkBox>
    );
};
```

## Where children go

Containers take children the way you expect: widgets nested inside a `GtkBox` are appended to it, a widget inside a `GtkButton` becomes its child. But GTK has many relationships that are not parent-child containment — a header bar's title widget, a menu button's menu model, an event controller watching a widget. These are **slot props** on the parent element, and their value is JSX:

- `addController` and `insertActionGroup` on every widget
- `layoutManager` on every widget
- `addAction` on application windows (see [Menus and actions](/docs/guides/menus-and-actions))
- `addShortcut` on `GtkShortcutController`
- `titleWidget`, `packStart`, and `packEnd` on header bars
- `menuModel` on `GtkMenuButton` and popover menus

```tsx
import { AdwHeaderBar } from "@gtkx/jsx/adw";
import { GMenu } from "@gtkx/jsx/gio";
import { GtkButton, GtkMenuButton } from "@gtkx/jsx/gtk";

const Header = ({ onSearch }: { onSearch: () => void }) => (
    <AdwHeaderBar
        packStart={<GtkButton iconName="system-search-symbolic" tooltipText="Search" onClicked={onSearch} />}
        packEnd={
            <GtkMenuButton
                iconName="open-menu-symbolic"
                menuModel={<GMenu items={[{ label: "About Notes", action: "win.about" }]} />}
            />
        }
    />
);
```

Event controllers and gestures attach through `addController`; wrap several in a fragment:

```tsx
import { GtkBox, GtkEventControllerKey, GtkEventControllerMotion, GtkLabel } from "@gtkx/jsx/gtk";
import { useState } from "react";

const InteractiveBox = () => {
    const [position, setPosition] = useState({ x: 0, y: 0 });

    return (
        <GtkBox
            focusable
            addController={
                <>
                    <GtkEventControllerMotion onMotion={(x, y) => setPosition({ x, y })} />
                    <GtkEventControllerKey
                        onKeyPressed={(keyval) => {
                            console.log("Key:", keyval);
                            return false;
                        }}
                    />
                </>
            }
        >
            <GtkLabel label={`Position: ${Math.round(position.x)}, ${Math.round(position.y)}`} />
        </GtkBox>
    );
};
```

::: warning
Nesting a slot element as a plain child throws an error naming the prop to use instead:

```
<GtkEventControllerMotion> cannot be a child of <GtkBox>: pass it through the `addController` prop instead.
```
:::

## Text is special

In the DOM, any element accepts text children. In GTKX, text children are valid in exactly two places: label-like widgets, where strings concatenate into the widget's label, and explicit buffer elements. Anywhere else, rendering a bare string throws:

```
Text strings must be rendered within a <GtkLabel> or <GtkTextBuffer> element
```

`<GtkLabel>{count} notes</GtkLabel>` works; `<GtkBox>Hello</GtkBox>` does not — wrap the text in a label. Editable text lives in an explicit `<GtkTextBuffer>` passed to a `GtkTextView` through its `buffer` prop:

```tsx
import * as Gtk from "@gtkx/gi/gtk";
import { GtkScrolledWindow, GtkTextBuffer, GtkTextView } from "@gtkx/jsx/gtk";

const BodyEditor = ({ body, onBodyChanged }: { body: string; onBodyChanged: (body: string) => void }) => (
    <GtkScrolledWindow vexpand>
        <GtkTextView
            wrapMode={Gtk.WrapMode.WORD_CHAR}
            buffer={
                <GtkTextBuffer
                    enableUndo
                    onChanged={(buffer) => {
                        const start = buffer.getStartIter();
                        const end = buffer.getEndIter();
                        onBodyChanged(buffer.getText(start, end, false) ?? "");
                    }}
                >
                    {body}
                </GtkTextBuffer>
            }
        />
    </GtkScrolledWindow>
);
```

## Lists own their items

In the browser you map an array to children. GTK's list widgets are virtualized — they recycle a handful of widgets across thousands of rows — and are normally driven by a `GListModel` plus item factories. GTKX hides that wiring entirely: `GtkListView`, `GtkGridView`, and `GtkColumnView` take an `items` array and a `renderItem` callback. Do not map your data to JSX children.

Each item is `{ id, value }`; selection is controlled through `selectionMode`, `selected`, and `onSelectionChanged`, and `estimatedItemHeight` helps the virtualizer before rows are measured:

```tsx
import * as Gtk from "@gtkx/gi/gtk";
import { GtkLabel, GtkListView, GtkScrolledWindow } from "@gtkx/jsx/gtk";
import { useState } from "react";

type Note = { id: string; title: string };

const NoteList = ({ notes }: { notes: Note[] }) => {
    const [selectedId, setSelectedId] = useState<string | null>(null);

    return (
        <GtkScrolledWindow vexpand>
            <GtkListView
                items={notes.map((note) => ({ id: note.id, value: note }))}
                renderItem={(note) => <GtkLabel label={note.title} xalign={0} />}
                estimatedItemHeight={48}
                selectionMode={Gtk.SelectionMode.SINGLE}
                selected={selectedId ? [selectedId] : []}
                onSelectionChanged={(ids) => setSelectedId(ids[0] ?? null)}
            />
        </GtkScrolledWindow>
    );
};
```

Tree lists, section headers, columns, and dropdowns follow the same contract — see the [Lists guide](/docs/guides/lists).

## The application owns the loop

`render(<App />)` is the counterpart of `createRoot().render()`: call it once in your entry file. The tree it mounts is expected to contain a `GtkApplication` or `AdwApplication` component, which constructs the GTK application, registers and activates it, and keeps the main loop running. `quit()` unmounts every rendered root; unmounting the application component stops the GTK runtime, so the process exits.

Closing a window is where browsers and GTK diverge: GTK destroys the window natively, behind React's back. The main window therefore vetoes the native close and lets React drive the teardown — return `true` from `onCloseRequest` and call `quit()`:

```tsx
import { applicationId } from "@gtkx/config/runtime";
import { GtkApplication, GtkApplicationWindow, GtkLabel } from "@gtkx/jsx/gtk";
import { quit, render } from "@gtkx/react";

const App = () => (
    <GtkApplication applicationId={applicationId}>
        <GtkApplicationWindow
            title="My App"
            onCloseRequest={() => {
                quit();
                return true;
            }}
        >
            <GtkLabel label="Hello, GTKX!" />
        </GtkApplicationWindow>
    </GtkApplication>
);

render(<App />);
```

Secondary windows take a `transientFor` prop, and Adwaita dialogs take a `parent` prop — see the [Windows guide](/docs/guides/windows).

## Raw instances, not refs

Props that accept a GObject value — `transientFor`, `keyCaptureWidget`, `accessibleLabelledBy` — take the raw instance, never a React ref. The reason is timing: during the commit's mutation phase, refs to widgets created in the same commit are still unpopulated. To feed one widget into another's prop, capture the instance in state with a callback ref, as shown in [Portals](/docs/portals).

Hooks that observe a GObject (`useSignal`, `useProperty`, `useTickCallback`) are more flexible: they take the instance, a `RefObject` holding it, or `null`/`undefined` to stay inactive. The target is resolved on every render, so a hook given a ref follows it across commits. Hooks return raw instances and values, never refs:

```tsx
import type * as Gtk from "@gtkx/gi/gtk";
import { GtkApplicationWindow, GtkLabel } from "@gtkx/jsx/gtk";
import { useProperty } from "@gtkx/react";
import { useRef } from "react";

const MainWindow = () => {
    const windowRef = useRef<Gtk.ApplicationWindow | null>(null);
    const title = useProperty(windowRef, "title");

    return (
        <GtkApplicationWindow ref={windowRef} title="Notes">
            <GtkLabel label={`Showing: ${title ?? ""}`} />
        </GtkApplicationWindow>
    );
};
```

## When to drop to `@gtkx/gi`

Every introspected GTK and GLib API is generated as classes and enums under `@gtkx/gi/<ns>` — the same bindings the components are built on. When an API has no component, it is one import away: construct objects, call methods, and connect signals directly. The toast pattern from the tutorial is the canonical example — `Adw.Toast` is a short-lived value with no place in the tree:

```tsx
import * as Adw from "@gtkx/gi/adw";
import { AdwToastOverlay } from "@gtkx/jsx/adw";
import { GtkButton } from "@gtkx/jsx/gtk";
import { useRef } from "react";

const NotesView = () => {
    const overlayRef = useRef<Adw.ToastOverlay | null>(null);

    const moveToTrash = () => {
        const toast = Adw.Toast.new("Note moved to Trash");
        toast.buttonLabel = "Undo";
        toast.once("button-clicked", () => console.log("Restored"));
        overlayRef.current?.addToast(toast);
    };

    return (
        <AdwToastOverlay ref={overlayRef}>
            <GtkButton label="Move to Trash" onClicked={moveToTrash} />
        </AdwToastOverlay>
    );
};
```

Enums (`Gtk.Orientation`, `Gtk.SelectionMode`), parsers (`Gtk.ShortcutTrigger.parseString`), and imperative dialogs all come from the same place. See [FFI Bindings](/docs/ffi-bindings) for how the bindings work.

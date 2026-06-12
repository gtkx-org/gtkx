# Dialogs

In GTKX a dialog is an ordinary component: mounting it presents it, unmounting it closes it. A dialog names the window it belongs to through a prop and never attaches to the surrounding widget, so it can render anywhere in your tree.

## Two parenting models

GTK has two kinds of dialog surfaces, and each names its parent differently.

**`Gtk.Window` descendants** — plain `GtkWindow`, `AdwWindow`, `AdwPreferencesWindow` — take the regular `transientFor` property prop, usually together with `modal`. `transientFor` is a live property: set it to a different window and the relationship moves, set it to `null` and it clears.

**`Adw.Dialog` descendants** — `AdwAlertDialog`, `AdwAboutDialog`, `AdwPreferencesDialog`, `AdwShortcutsDialog` — take a `parent` prop instead. It is consumed once when the dialog mounts: the dialog is presented against the window the prop carried at that moment, and later changes to the prop have no effect.

```tsx
<GtkWindow transientFor={mainWindow} modal title="Inspector" />

<AdwAlertDialog parent={mainWindow} heading="Delete Note?" />
```

::: warning
Both `transientFor` and `parent` take a raw `Gtk.Window` instance, never a React ref — a ref is still unpopulated during the commit that mounts the dialog. See [Getting a parent window](#getting-a-parent-window) for the two ways to obtain one.
:::

Because dialogs never attach to the surrounding widget, no portal is involved. To render regular widgets into a different GTK container, see [Portals](../portals.md).

## Presenting dialogs from state

Dialog visibility is plain React state. Conditional rendering mounts the dialog, which presents it; flipping the state back unmounts it, which closes it. The tutorial's Notes app drives all of its dialogs this way — window actions turn the state on, and each dialog's close callback turns it off:

```tsx
// src/app.tsx
import { AdwApplicationWindow } from "@gtkx/jsx/adw";
import { GSimpleAction } from "@gtkx/jsx/gio";
import { quit } from "@gtkx/react";
import { useState } from "react";
import { About } from "./components/about.js";
import { Preferences } from "./components/preferences.js";

function NotesWindow() {
    const [showPreferences, setShowPreferences] = useState(false);
    const [showAbout, setShowAbout] = useState(false);

    return (
        <AdwApplicationWindow
            title="Notes"
            defaultWidth={900}
            defaultHeight={600}
            onCloseRequest={() => {
                quit();
                return true;
            }}
            addAction={
                <>
                    <GSimpleAction
                        name="preferences"
                        onActivate={() => setShowPreferences(true)}
                        accels="<Control>comma"
                    />
                    <GSimpleAction name="about" onActivate={() => setShowAbout(true)} />
                </>
            }
        >
            <NotesContent />
            {showPreferences && <Preferences onClose={() => setShowPreferences(false)} />}
            {showAbout && <About onClose={() => setShowAbout(false)} />}
        </AdwApplicationWindow>
    );
}
```

A menu entry such as `{ label: "About Notes", action: "win.about" }` activates the `win.about` action, which sets the state; the dialog's `onClose` callback resets it when the dialog closes, keeping React state and what is on screen in sync.

## Getting a parent window

Since `parent` and `transientFor` take a raw window instance, you need one in scope. There are two patterns.

**The active window.** `useApplication` returns the running application, and `useProperty` subscribes to its `activeWindow` property. Returning `null` until a window exists keeps the dialog unmounted:

```tsx
import { AdwAboutDialog } from "@gtkx/jsx/adw";
import { useApplication, useProperty } from "@gtkx/react";

const About = ({ onClose }: { onClose: () => void }) => {
    const app = useApplication();
    const activeWindow = useProperty(app, "activeWindow");

    if (!activeWindow) return null;

    return <AdwAboutDialog parent={activeWindow} applicationName="Notes" onClosed={onClose} />;
};
```

**A callback ref into state.** When you own the window element, pass a state setter as its `ref`. A `useRef` object would not work here because populating it does not re-render; state does, so the dialog mounts on the commit after the window exists:

```tsx
import type * as Gtk from "@gtkx/gi/gtk";
import { GtkApplicationWindow, GtkWindow } from "@gtkx/jsx/gtk";
import { useState } from "react";

const App = ({ showInspector }: { showInspector: boolean }) => {
    const [parent, setParent] = useState<Gtk.Window | null>(null);

    return (
        <GtkApplicationWindow ref={setParent} title="Main" defaultWidth={900} defaultHeight={600}>
            {showInspector && parent && (
                <GtkWindow transientFor={parent} modal title="Inspector" defaultWidth={400} defaultHeight={300} />
            )}
        </GtkApplicationWindow>
    );
};
```

## Alert dialogs and responses

`AdwAlertDialog` models its buttons as a `responses` array. Each entry has an `id` and a `label`, plus an optional `appearance` (`Adw.ResponseAppearance.DEFAULT`, `SUGGESTED`, or `DESTRUCTIVE`) and an optional `enabled`. The `onResponse` callback receives the `id` of whichever response the user chose; `defaultResponse` names the response activated by <kbd>Enter</kbd>, and `closeResponse` the one reported when the dialog is dismissed:

```tsx
import * as Adw from "@gtkx/gi/adw";
import { AdwAlertDialog } from "@gtkx/jsx/adw";
import { useApplication, useProperty } from "@gtkx/react";

export const DeleteConfirmation = ({
    noteTitle,
    onConfirm,
    onCancel,
}: {
    noteTitle: string;
    onConfirm: () => void;
    onCancel: () => void;
}) => {
    const app = useApplication();
    const activeWindow = useProperty(app, "activeWindow");

    if (!activeWindow) return null;

    return (
        <AdwAlertDialog
            parent={activeWindow}
            heading="Delete Note?"
            body={`"${noteTitle}" will be permanently deleted.`}
            responses={[
                { id: "cancel", label: "Cancel" },
                { id: "delete", label: "Delete", appearance: Adw.ResponseAppearance.DESTRUCTIVE },
            ]}
            defaultResponse="cancel"
            closeResponse="cancel"
            onResponse={(id) => {
                if (id === "delete") onConfirm();
                else onCancel();
            }}
        />
    );
};
```

The `responses` array is diffed across renders like any other prop: changing a label, appearance, or enabled state updates the button in place, and adding or removing entries adds or removes buttons.

To embed widgets in an alert dialog, pass them through the `extraChild` prop:

```tsx
<AdwAlertDialog
    parent={activeWindow}
    heading="Rename Note"
    defaultResponse="ok"
    closeResponse="cancel"
    onResponse={onResponse}
    extraChild={<GtkEntry text={title} onChanged={(entry) => setTitle(entry.getText())} />}
    responses={[
        { id: "cancel", label: "_Cancel" },
        { id: "ok", label: "_OK" },
    ]}
/>
```

## About dialogs

`AdwAboutDialog` takes the application's metadata as props and a `parent` like any other `Adw.Dialog` descendant. The `onClosed` callback is where you reset the state that mounted it:

```tsx
import * as Gtk from "@gtkx/gi/gtk";
import { AdwAboutDialog } from "@gtkx/jsx/adw";
import { useApplication, useProperty } from "@gtkx/react";

export const About = ({ onClose }: { onClose: () => void }) => {
    const app = useApplication();
    const activeWindow = useProperty(app, "activeWindow");

    if (!activeWindow) return null;

    return (
        <AdwAboutDialog
            parent={activeWindow}
            applicationName="Notes"
            applicationIcon="document-edit-symbolic"
            version="0.1.0"
            developerName="GTKX Tutorial"
            website="https://gtkx.dev"
            issueUrl="https://github.com/gtkx-org/gtkx/issues"
            copyright="© 2026 GTKX Contributors"
            licenseType={Gtk.License.MPL_2_0}
            developers={["GTKX Contributors"]}
            onClosed={onClose}
        />
    );
};
```

## Preferences

`AdwPreferencesWindow` is a `Gtk.Window` descendant, so it uses `transientFor` and `modal`. Its `onCloseRequest` handler returns `true` to veto GTK's native close and instead resets the state that mounted it, so React performs the unmount:

```tsx
import { AdwPreferencesGroup, AdwPreferencesPage, AdwPreferencesWindow, AdwSpinRow, AdwSwitchRow } from "@gtkx/jsx/adw";
import { useAdjustment, useApplication, useProperty, useSetting } from "@gtkx/react";
import schema from "../com.example.notes.gschema.xml";

export const Preferences = ({ onClose }: { onClose: () => void }) => {
    const app = useApplication();
    const activeWindow = useProperty(app, "activeWindow");

    const [compactMode, setCompactMode] = useSetting(schema, "compact-mode");
    const [fontSize, setFontSize] = useSetting(schema, "font-size");
    const fontSizeAdjustment = useAdjustment({ value: fontSize, lower: 8, upper: 32, stepIncrement: 1 });

    if (!activeWindow) return null;

    return (
        <AdwPreferencesWindow
            title="Preferences"
            transientFor={activeWindow}
            modal
            defaultWidth={500}
            defaultHeight={400}
            onCloseRequest={() => {
                onClose();
                return true;
            }}
        >
            <AdwPreferencesPage title="General" iconName="preferences-system-symbolic">
                <AdwPreferencesGroup title="Appearance">
                    <AdwSwitchRow
                        title="Compact Mode"
                        subtitle="Use smaller spacing in the note list"
                        active={compactMode}
                        onNotifyActive={(active) => setCompactMode(active ?? false)}
                    />
                </AdwPreferencesGroup>
                <AdwPreferencesGroup title="Editor">
                    <AdwSpinRow
                        title="Font Size"
                        subtitle="Base font size for the editor"
                        adjustment={fontSizeAdjustment}
                        onNotifyValue={(value) => setFontSize(value ?? 8)}
                    />
                </AdwPreferencesGroup>
            </AdwPreferencesPage>
        </AdwPreferencesWindow>
    );
};
```

Pages hold titled groups, and groups hold rows: `AdwSwitchRow` for booleans, `AdwSpinRow` for numbers, `AdwComboRow` for choices. [Chapter 7 of the tutorial](../tutorial/7-settings-and-preferences.md) walks through binding these rows to GSettings with `useSetting`.

::: tip
`AdwPreferencesDialog` is the `Adw.Dialog` counterpart: same pages and groups, but presented with a `parent` prop instead of `transientFor`.
:::

## File, color, and font pickers

GTK 4's pickers are plain GObjects with promise-returning methods — there is no widget to mount. Construct one from `@gtkx/gi/gtk`, pass the parent window, and `await` the result:

```tsx
import * as Gtk from "@gtkx/gi/gtk";

const openFile = async (parent: Gtk.Window | null) => {
    const dialog = new Gtk.FileDialog();
    try {
        const file = await dialog.open(parent, null);
        console.log(file.getBasename());
    } catch (error) {
        if (error instanceof Error) console.error(error.message);
    }
};
```

The promise rejects when the user dismisses the picker, so wrap the `await` in `try`/`catch`. The second argument takes a `Gio.Cancellable` to abort the dialog programmatically. `Gtk.FileDialog` also offers `save`, `selectFolder`, and `openMultiple`; `Gtk.ColorDialog.chooseRgba(parent, initialColor)` resolves to a `Gdk.RGBA`, and `Gtk.FontDialog.chooseFont(parent, initialValue)` to a `Pango.FontDescription`.

For a button that opens the picker and displays the current value, use the dedicated elements. Their `dialog` prop is a slot taking a `GtkColorDialog` or `GtkFontDialog` element whose props (`title`, `modal`, `withAlpha`) are diffed like any other element's:

```tsx
import * as Gtk from "@gtkx/gi/gtk";
import * as Pango from "@gtkx/gi/pango";
import { GtkBox, GtkColorDialog, GtkColorDialogButton, GtkFontDialog, GtkFontDialogButton } from "@gtkx/jsx/gtk";

const PickerRow = ({ onColorChanged }: { onColorChanged: (red: number) => void }) => (
    <GtkBox spacing={6}>
        <GtkColorDialogButton
            dialog={<GtkColorDialog title="Pick a Color" withAlpha={false} />}
            onNotifyRgba={(rgba) => onColorChanged(rgba?.red ?? 0)}
        />
        <GtkFontDialogButton
            dialog={<GtkFontDialog title="Select Font" />}
            fontDesc={Pango.FontDescription.fromString("Sans Bold 12")}
            level={Gtk.FontLevel.FONT}
        />
    </GtkBox>
);
```

`GtkColorDialogButton` takes an initial `rgba` (a `Gdk.RGBA`) and reports changes through `onNotifyRgba`. `GtkFontDialogButton` takes a `fontDesc`, a `level` (`Gtk.FontLevel.FAMILY`, `FONT`, or `FEATURES`), and `useFont`/`useSize` to preview the selection in the button itself.

## Testing dialogs

A presented dialog's widgets live inside a real window tree, so `@gtkx/testing` queries find them like any other widget. For dialog-specific state, capture the backing instance with a ref:

```tsx
import type * as Adw from "@gtkx/gi/adw";
import { AdwAlertDialog } from "@gtkx/jsx/adw";
import { render } from "@gtkx/testing";
import { createRef } from "react";
import { expect, it } from "vitest";

it("registers its responses", async () => {
    const ref = createRef<Adw.AlertDialog>();

    await render(
        <AdwAlertDialog
            ref={ref}
            heading="Delete Note?"
            responses={[
                { id: "cancel", label: "Cancel" },
                { id: "delete", label: "Delete" },
            ]}
        />,
        { wrapper: false },
    );

    expect(ref.current?.hasResponse("delete")).toBe(true);
});
```

See the [Testing](../testing.md) guide for queries, `userEvent`, and `waitFor`.

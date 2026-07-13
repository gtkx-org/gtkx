---
description: "GNOME's undo-first feedback hierarchy: toasts with Undo, informational dialogs, and a destructive alert only where undo is impossible."
---

# Feedback and Dialogs

Deleting a task in Tasks does not pop a "Are you sure?" box. It quietly moves the task to Trash and slides up a toast with an **Undo** button. That is deliberate. GNOME's Human Interface Guidelines put reversibility first: if an action can be undone, let the user do it and undo it, and save the modal interruption for the one action that genuinely cannot be taken back. This page walks the whole feedback hierarchy in the app, from the lightest touch (a toast) to the heaviest (a destructive alert dialog), plus the two informational dialogs (New List, About) and the one gtkx mechanism that makes any of them appear on screen.

## The undo-first hierarchy

Three surfaces, three weights:

- **Undo toast** for reversible destructive actions. Delete a task, delete a batch: the task goes to Trash, a toast offers Undo, and the app never blocks. This is the common path.
- **Destructive alert dialog** for the one irreversible action: emptying a task permanently out of Trash. Here undo is impossible, so a modal confirm is warranted.
- **Informational dialogs** (New List, About, Preferences) for input and metadata, not for destruction.

The payoff for a React developer is that the first two map onto two very different gtkx idioms. Toasts are **imperative**: you build one and hand it to an overlay through a ref, because a toast is ephemeral and lives outside the component tree. Dialogs are **declarative**: you mount a component and it presents; you unmount it and it closes. Getting the distinction is most of this page.

## Undo toasts

Toasts are shown by an `AdwToastOverlay` that wraps the window content. The overlay is a single-child container (it draws one toast at a time over whatever it wraps), so in `app.tsx` it sits just inside the window and wraps the entire split view:

```tsx
const toastOverlayRef = useRef<Adw.ToastOverlay | null>(null);

// ...

<AdwToastOverlay ref={toastOverlayRef}>
    <AdwNavigationSplitView
        collapsed={collapsed}
        // ...
    />
</AdwToastOverlay>
```

You do not render toasts as JSX children. There is no `<AdwToast>` in the tree. A toast appears in response to an event, times out, and is gone, so gtkx exposes `AdwToastOverlay` through a `ref` and you add toasts imperatively. Here is the single-task delete handler:

```tsx
const handleDelete = (task: Task): void => {
    if (task.deleted) {
        setTaskToDelete(task);
        return;
    }
    api.moveToTrash(task.id);
    if (selectedTaskId === task.id) setSelectedTaskId(null);
    const toast = Adw.Toast.new(`“${task.title}” moved to Trash`);
    toast.buttonLabel = "Undo";
    toast.once("button-clicked", () => api.restore(task.id));
    toastOverlayRef.current?.addToast(toast);
};
```

Four things are happening:

1. **`Adw.Toast.new(title)`** constructs the toast with its message. `Adw.Toast` comes from `@gtkx/gi/adw`, the raw GI namespace, because a toast is not a widget you place, it is an object you build.
2. **`toast.buttonLabel = "Undo"`** adds the action button. Setting `buttonLabel` is what makes the toast show a button at all. An informational toast with no button just leaves it unset.
3. **`toast.once("button-clicked", ...)`** connects the restore callback. `once` (not `on`) fires it at most one time, which is exactly right: the user can click Undo once, and after that the toast is done. The callback calls back into the task API to restore the trashed task.
4. **`toastOverlayRef.current?.addToast(toast)`** hands the finished toast to the overlay, which animates it in, queues it if another is showing, and dismisses it after its timeout.

The batch case in `deleteSelected` is the same shape, just restoring a list of ids and pluralizing the message:

```tsx
const deleteSelected = (): void => {
    const ids = [...selectedIds];
    api.trashMany(ids);
    const toast = Adw.Toast.new(`${ids.length} task${ids.length === 1 ? "" : "s"} moved to Trash`);
    toast.buttonLabel = "Undo";
    toast.once("button-clicked", () => {
        for (const id of ids) api.restore(id);
    });
    toastOverlayRef.current?.addToast(toast);
    cancelSelection();
};
```

Note `const ids = [...selectedIds]`: the ids are copied into the closure before selection is cleared, so the Undo callback restores the right tasks even though `cancelSelection()` resets the selection state immediately after.

::: tip
`AdwToastOverlay` shows one toast at a time and times each out after about five seconds (a toast will not disappear while it is hovered or focused). Both delete paths, single and batch, funnel into this one recovery mechanism, so there is a single "undo a delete" story in the app instead of two.
:::

## Confirming the irreversible

Look again at the first two lines of `handleDelete`:

```tsx
if (task.deleted) {
    setTaskToDelete(task);
    return;
}
```

If the task is already in Trash (`task.deleted`), there is nothing left to soft-delete: the next delete is permanent. So instead of a toast, `handleDelete` sets `taskToDelete` state, which mounts the confirmation dialog. This is the one place in the app that asks before acting.

`delete-confirmation.tsx` is short and worth reading whole:

```tsx
import { AlertDialog, Dialog } from "@gtkx/components/adw";
import * as Adw from "@gtkx/gi/adw";

export const DeleteConfirmation = ({
    taskTitle,
    onConfirm,
    onCancel,
}: {
    taskTitle: string;
    onConfirm: () => void;
    onCancel: () => void;
}) => {
    return (
        <Dialog>
            <AlertDialog
                heading="Delete Task?"
                body={`“${taskTitle}” will be permanently deleted. This cannot be undone.`}
                defaultResponse="cancel"
                closeResponse="cancel"
                onResponse={(id) => {
                    if (id === "delete") onConfirm();
                    else onCancel();
                }}
            >
                <AlertDialog.Response id="cancel" label="Cancel" />
                <AlertDialog.Response id="delete" label="Delete" appearance={Adw.ResponseAppearance.DESTRUCTIVE} />
            </AlertDialog>
        </Dialog>
    );
};
```

`AlertDialog` (from `@gtkx/components/adw`) wraps the `AdwAlertDialog` widget. Its responses (the buttons) are declared as `<AlertDialog.Response>` children rather than an imperative `addResponse` call:

- **`id`** is what comes back to `onResponse`. Here `"delete"` runs `onConfirm`, everything else runs `onCancel`.
- **`label`** is the button text. Use a specific verb ("Delete"), not "OK", so the button reads clearly on its own.
- **`appearance={Adw.ResponseAppearance.DESTRUCTIVE}`** paints the Delete button red. `SUGGESTED` (used by New List below) paints it as the accent affirmative; leaving it unset gives a neutral button.

Two safety properties keep the destructive button from firing by accident:

- **`defaultResponse="cancel"`** makes Cancel the response bound to Return, so hitting Enter cannot delete.
- **`closeResponse="cancel"`** makes Escape (and any other dismissal) resolve to Cancel.

The Cancel response is declared before Delete, which is also the on-screen order: the safe choice sits to the left of the affirmative in a left-to-right layout.

`onResponse` fires once with the chosen `id` and the app closes the dialog by clearing state. Back in `app.tsx`, `onConfirm` is `confirmDelete`:

```tsx
const confirmDelete = (): void => {
    if (!taskToDelete) return;
    api.deleteForever(taskToDelete.id);
    if (selectedTaskId === taskToDelete.id) setSelectedTaskId(null);
    setTaskToDelete(null);
};
```

`deleteForever` actually removes it; `setTaskToDelete(null)` unmounts the dialog. `onCancel` simply does `setTaskToDelete(null)`, unmounting without deleting.

## How a dialog gets on screen

`DeleteConfirmation` is mounted conditionally at the bottom of the window, next to the other dialogs:

```tsx
{showAbout ? <About onClose={() => setShowAbout(false)} /> : null}
{showNewList ? (
    <NewListDialog
        onAdd={(name, color) => {
            api.addList(name, color);
            setShowNewList(false);
        }}
        onCancel={() => setShowNewList(false)}
    />
) : null}
{taskToDelete ? (
    <DeleteConfirmation
        taskTitle={taskToDelete.title}
        onConfirm={confirmDelete}
        onCancel={() => setTaskToDelete(null)}
    />
) : null}
```

Mounting the component shows the dialog; unmounting it closes the dialog. That is the whole contract, and the `<Dialog>` wrapper is what makes it true.

A GTK dialog is not a child widget you slot into a layout. It is a free-floating `Adw.Dialog` that you `present(parent)` to show and `forceClose()` to dismiss, anchored to a parent window. `<Dialog>` from `@gtkx/components/adw` bridges that imperative API to React's declarative lifecycle. It takes a single dialog child, renders it through a **portal to the top-level root** (not into the surrounding widget tree), and drives present/close from an effect:

```tsx
export const Dialog = ({ parent, children }: DialogProps): ReactNode => {
    const parentWindow = useParentWindow();
    const resolvedParent = parent === undefined ? parentWindow : parent;
    // ...
    useLayoutEffect(() => {
        if (!dialog) return;
        dialog.present(resolvedParent);
        return () => dialog.forceClose();
    }, [dialog, resolvedParent]);

    if (element === null) return null;
    return createPortal(cloneElement(element, { ref: mergedRef }), rootElement);
};
```

- **`createPortal(..., rootElement)`** mounts the dialog at the application root instead of inline. A dialog is a detached top-level surface, so it must not live inside the split view's widget hierarchy; the portal puts it where GTK expects it.
- **`useParentWindow()`** finds the enclosing `AdwApplicationWindow` so the dialog can be presented transient-for it (correct positioning, modality, focus). You can override the anchor with the `parent` prop, but omitting it, as every dialog in this app does, anchors to the current window.
- **`present` on mount, `forceClose` on the effect cleanup.** When React mounts `<DeleteConfirmation>`, the effect runs and the dialog presents. When `setTaskToDelete(null)` unmounts it, the cleanup runs `forceClose()` and the dialog disappears. `forceClose` bypasses any close confirmation, which is what you want when React state, not the widget, owns whether the dialog is open.

Everything presentable this way (`AdwAlertDialog`, `AdwAboutDialog`, `AdwPreferencesDialog`) extends `Adw.Dialog`, so it satisfies the `present`/`forceClose` contract `<Dialog>` requires. Preferences uses the identical pattern: `preferences.tsx` wraps an `AdwPreferencesDialog` in the same `<Dialog>`, presented and closed by the same `showPreferences` state toggle. One wrapper covers every modal in the app.

## The New List dialog: a form in an alert dialog

An alert dialog is not limited to a heading and body text. Any non-`Response` child becomes the dialog body, so `new-list-dialog.tsx` puts an entry and a row of color swatches inside the same `AlertDialog` used for confirmation:

```tsx
const PALETTE = ["#3584e4", "#2ec27e", "#e66100", "#9141ac", "#e01b24", "#f5c211"];

export const NewListDialog = ({
    onAdd,
    onCancel,
}: {
    onAdd: (name: string, color: string) => void;
    onCancel: () => void;
}) => {
    const [name, setName] = useState("");
    const [color, setColor] = useState(PALETTE[0]);

    return (
        <Dialog>
            <AlertDialog
                heading="New List"
                defaultResponse="add"
                closeResponse="cancel"
                onResponse={(id) => {
                    if (id === "add") onAdd(name, color);
                    else onCancel();
                }}
            >
                <GtkBox orientation={Gtk.Orientation.VERTICAL} spacing={16} marginTop={8}>
                    <GtkEntry placeholderText="List name" activatesDefault onChanged={(self) => setName(self.text)} />
                    <GtkBox spacing={6} halign={Gtk.Align.CENTER}>
                        {PALETTE.map((swatch) => (
                            <GtkToggleButton
                                key={swatch}
                                active={color === swatch}
                                cssClasses={["flat"]}
                                accessibleLabel={`Color ${swatch}`}
                                onClicked={() => setColor(swatch)}
                            >
                                <GtkBox
                                    widthRequest={22}
                                    heightRequest={22}
                                    cssClasses={[listDot(swatch)]}
                                    accessibleRole={Gtk.AccessibleRole.PRESENTATION}
                                />
                            </GtkToggleButton>
                        ))}
                    </GtkBox>
                </GtkBox>
                <AlertDialog.Response id="cancel" label="Cancel" />
                <AlertDialog.Response id="add" label="Add" appearance={Adw.ResponseAppearance.SUGGESTED} />
            </AlertDialog>
        </Dialog>
    );
};
```

The form is ordinary controlled React: local `name` and `color` state, `onChanged={(self) => setName(self.text)}` on the `GtkEntry` (GTK signal handlers pass the emitting widget last as `self`, so `self.text` is the live entry text), and a `GtkToggleButton` per swatch whose `active` is driven by comparing against `color`. When the user picks "Add", `onResponse` reads the current `name` and `color` out of state and calls `onAdd`.

Two details make it feel native. **`activatesDefault`** on the entry means pressing Return in the text field triggers the default response, and `defaultResponse="add"` makes that Add. So you can type a name and hit Enter without reaching for the mouse. **`Adw.ResponseAppearance.SUGGESTED`** styles Add as the accent affirmative (blue), the counterpart to the destructive red on the delete confirm.

The swatches also show the accessibility pattern for decorative content: the visible colored square is a `GtkBox` marked `accessibleRole={Gtk.AccessibleRole.PRESENTATION}` (it is pure decoration, hidden from assistive tech), while the meaning lives on the button's ``accessibleLabel={`Color ${swatch}`}``.

## The About dialog

`AdwAboutDialog` is a purpose-built widget: give it your app's metadata and it renders the standard GNOME about screen, credits, license, and links included. `about.tsx` is entirely declarative, no imperative calls:

```tsx
import { Dialog } from "@gtkx/components/adw";
import * as Gtk from "@gtkx/gi/gtk";
import { AdwAboutDialog } from "@gtkx/jsx/adw";

export const About = ({ onClose }: { onClose: () => void }) => {
    return (
        <Dialog>
            <AdwAboutDialog
                applicationName="Tasks"
                applicationIcon="com.gtkx.tutorial"
                version="1.0.0"
                developerName="GTKX"
                website="https://gtkx.dev"
                issueUrl="https://github.com/gtkx-org/gtkx/issues"
                copyright="© 2026 GTKX Contributors"
                licenseType={Gtk.License.MPL_2_0}
                developers={["GTKX Contributors"]}
                comments="A task manager built with GTKX to showcase React, GTK4, and libadwaita."
                onClosed={onClose}
            />
        </Dialog>
    );
};
```

`applicationIcon="com.gtkx.tutorial"` is the app id, which resolves to the installed icon. `licenseType={Gtk.License.MPL_2_0}` (an enum from `@gtkx/gi/gtk`) lets the dialog render the correct license text and link without you supplying the prose. `developers` is a string array, and `website`/`issueUrl` become the standard action links. `onClosed` fires when the dialog is dismissed; here it flips `showAbout` back to false, which unmounts `<About>` and, through the `<Dialog>` cleanup, force-closes the underlying widget.

Note the difference between `onResponse` on an alert dialog (fires with the chosen response id) and `onClosed` on About (just signals dismissal). About has no responses to choose, only a close, so there is nothing to branch on.

## Next

Continue to **Testing the App** to see how the accessibility metadata set on these dialogs and rows makes the whole app queryable, and how `@gtkx/testing` drives it with user events.

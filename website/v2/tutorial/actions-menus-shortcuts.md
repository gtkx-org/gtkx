---
description: "Create notes and open dialogs from menus and keyboard shortcuts with GIO actions."
---

# Add Menus and Shortcuts

Declare the app's commands as GIO actions, then reach them from header bar menus, buttons and keyboard shortcuts.

::: info Being written
This chapter belongs to the Notes tutorial for GTKX 2.0 and is not written yet. The headings below are its plan; the [finished app](https://github.com/gtkx-org/gtkx/tree/main/tutorial) already contains the code.
:::

## Window actions

`WindowActions` declares New Note, the preview toggle, Keyboard Shortcuts and About as `GSimpleAction` elements for the window's `actions` prop. New Note stays disabled until the folder has loaded. The preview is a stateful action: its boolean state comes from the window's `preview` state, and `onChangeState` sets it. See [Declaring actions](/v2/guide/actions#declaring-actions).

<<< @/figures/tutorial/actions-menus-shortcuts/src/components/window-actions.tsx [src/components/window-actions.tsx]

New Note writes `Untitled.md`, or `Untitled 2.md` and so on when that name is taken, then opens it. The provider's `create` remembers the new file's text, so the folder watcher treats it as the app's own write.

<<< @/figures/tutorial/actions-menus-shortcuts/src/notes/files.ts{70-90,93} [src/notes/files.ts]

<<< @/figures/tutorial/actions-menus-shortcuts/src/notes/note-saver.ts{45-48} [src/notes/note-saver.ts]

<<< @/figures/tutorial/actions-menus-shortcuts/src/notes/notes-provider.tsx{5,14,90-98,109} [src/notes/notes-provider.tsx]

An action runs outside any screen, so it opens the note through a navigation container ref instead of a screen's `navigation` prop.

<<< @/figures/tutorial/actions-menus-shortcuts/src/navigation.ts{2,14,29-31,33} [src/navigation.ts]

## Menus

The main menu sits at the end of the sidebar header, and each item names the action it runs. See [Menus](/v2/guide/actions#menus).

<<< @/figures/tutorial/actions-menus-shortcuts/src/components/main-menu.tsx [src/components/main-menu.tsx]

The window moves from `app.tsx` into `components/window.tsx`, inside `NotesProvider` and `ToastProvider`, because `WindowActions` reads both. The sidebar header gains a New Note button, the note count and the main menu; the preview toggle now runs `win.preview` and shows its state. See [Buttons](/v2/guide/actions#buttons).

<<< @/figures/tutorial/actions-menus-shortcuts/src/components/window.tsx{26,44-52,59-65,68,81-82,92-98,103-106} [src/components/window.tsx]

`NotesTitle` shows the note count, and the empty folder's status page gets a New Note button.

<<< @/figures/tutorial/actions-menus-shortcuts/src/components/notes-screen.tsx{5,8,94-107,133-140,217} [src/components/notes-screen.tsx]

## Keyboard shortcuts

The application element binds keys to actions with `actionAccels`, and its own `quit` action becomes `app.quit`. Menus show the keys beside their items. See [Keyboard accelerators](/v2/guide/actions#keyboard-accelerators).

<<< @/figures/tutorial/actions-menus-shortcuts/src/app.tsx [src/app.tsx]

The shortcuts dialog reads each action's keys from `actionAccels`. Ctrl+F belongs to no action (it is the search entry's shortcut from [Search in a Worker](/v2/tutorial/search-in-a-worker)), so its item names the keys. See [The shortcuts dialog](/v2/guide/actions#the-shortcuts-dialog).

<<< @/figures/tutorial/actions-menus-shortcuts/src/components/shortcuts.tsx [src/components/shortcuts.tsx]

## Mount the dialogs

The window keeps which dialog is open in a `dialog` state that the Keyboard Shortcuts and About actions set. `Dialogs` renders that dialog, and its `onClosed` clears the state. See [Dialogs](/v2/guide/modals-and-portals#dialogs).

<<< @/figures/tutorial/actions-menus-shortcuts/src/components/dialogs.tsx [src/components/dialogs.tsx]

<<< @/figures/tutorial/actions-menus-shortcuts/src/components/about.tsx [src/components/about.tsx]

## Run it

Press Ctrl+N. An Untitled note opens in the editor, and the sidebar title counts one more note. Open the main menu: New Note and Keyboard Shortcuts show their keys. Ctrl+Shift+P switches to the preview and back, and the eye button follows. Ctrl+? opens the shortcuts dialog, and Ctrl+Q quits.

<figure class="result">
    <img class="result-light" src="/figures/tutorial-actions-menus-shortcuts-light.png" width="720" height="480" loading="lazy" alt="The Notes window with an empty Untitled note open and listed first in the sidebar, the sidebar title reading 6 notes, and the main menu open with New Note (Ctrl+N), Keyboard Shortcuts (Ctrl+?) and About Notes." />
    <img class="result-dark" src="/figures/tutorial-actions-menus-shortcuts-dark.png" width="720" height="480" loading="lazy" alt="The Notes window with an empty Untitled note open and listed first in the sidebar, the sidebar title reading 6 notes, and the main menu open with New Note (Ctrl+N), Keyboard Shortcuts (Ctrl+?) and About Notes." />
    <figcaption>Captured from <a href="#menus"><code>src/components/window.tsx</code></a> above, after Ctrl+N and with the main menu open.</figcaption>
</figure>

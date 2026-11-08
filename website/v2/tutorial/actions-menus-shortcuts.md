---
description: "Create notes and open dialogs from menus and keyboard shortcuts with GIO actions."
---

# Add Menus and Shortcuts

Turn New Note, the preview toggle and the app's dialogs into GIO actions, and run them from header bar buttons, a main menu and keyboard shortcuts.

## Window actions

A command that a menu item, a button and a key all run is a GIO action: a named command that each of them activates by its name. Declaring it once keeps them in step, so disabling the action greys out its menu item and button and stops its key. `src/components/window-actions.tsx` declares the window's actions as `GSimpleAction` elements:

<<< @/figures/tutorial/actions-menus-shortcuts/src/components/window-actions.tsx [src/components/window-actions.tsx]

- The window takes these elements in its `actions` prop, and each becomes an action named `win.` followed by its `name`, such as `win.new-note`. See [Declaring actions](/v2/guide/actions#declaring-actions).
- New Note is `enabled` once the folder has loaded. Until then `notes` is `null`, and everything that runs the action shows it as unavailable.
- Preview is a stateful action. Its state is a boolean `GLib.Variant` made from the window's `preview` state, and `onChangeState` stores the value it is asked to change to. Activating a boolean action that has no `onActivate` requests the opposite state, so the action toggles without one. See [Parameters and state](/v2/guide/actions#parameters-and-state).
- Keyboard Shortcuts and About pass the dialog to show to `onShowDialog`. [Mount the dialogs](#mount-the-dialogs) renders it.
- `useNoteCommands` holds the commands the actions run. A command that fails shows its error in a toast. `useMarkup: false` shows the message as plain text, since an error message can contain characters such as `<` and `&` that markup would misread.

New Note writes an empty `Untitled.md` and opens it. `createNote`, in `src/notes/files.ts`, tries `Untitled`, then `Untitled 2`, `Untitled 3` and so on:

<<< @/figures/tutorial/actions-menus-shortcuts/src/notes/files.ts{70-91,93} [src/notes/files.ts]

- The `wx` [flag](https://nodejs.org/api/fs.html#file-system-flags) makes `writeFile` fail with `EEXIST` when the file already exists instead of replacing it, so a new note never overwrites another, even one that another program created a moment before. Checking for the file and then writing it would leave a gap for that to happen.
- `isTaken` recognizes that error and moves on to the next name. Any other error, such as a folder the app can't write to, ends the loop and reaches the toast.

The provider's `create` adds the note to the list at once and tells the saver about the file:

<<< @/figures/tutorial/actions-menus-shortcuts/src/notes/note-saver.ts{45-48} [src/notes/note-saver.ts]

<<< @/figures/tutorial/actions-menus-shortcuts/src/notes/notes-provider.tsx{5,14,90-99,108-110} [src/notes/notes-provider.tsx]

- Writing the file fires the folder watcher from [Watch the folder](/v2/tutorial/saving-and-watching#watch-the-folder). `remember` records the text as the app's own write, so the watcher skips the event, as it skips the saver's own saves.
- `create` returns the name it used, which can differ from the one it was given.

An action runs outside any screen, so it has no screen's `navigation` prop to open the note with. `src/navigation.ts` creates a navigation container ref, which the window passes to `NavigationContainer` below, and `openNote` navigates through it:

<<< @/figures/tutorial/actions-menus-shortcuts/src/navigation.ts{1-5,14-15,29-33} [src/navigation.ts]

See React Navigation's [Navigation ref](https://reactnavigation.org/docs/navigation-ref).

## Menus

The main menu sits at the end of the sidebar's header bar. `GMenu` describes it as data, and each item names the action it runs:

<<< @/figures/tutorial/actions-menus-shortcuts/src/components/main-menu.tsx [src/components/main-menu.tsx]

- `section` groups items between separators. Keyboard Shortcuts and About Notes go in the last group, and Quit stays out of the menu, as the [GNOME HIG](https://developer.gnome.org/hig/patterns/controls/menus.html) asks of a primary menu.
- `primary` makes F10 open the menu.
- An item whose action is disabled is greyed out, so New Note is unavailable while the folder loads. See [Menus](/v2/guide/actions#menus).

The window moves from `src/app.tsx` into `src/components/window.tsx`, and its sidebar header gains a New Note button, the note count and the main menu:

<<< @/figures/tutorial/actions-menus-shortcuts/src/components/window.tsx{26,44-52,59-65,68,81-82,92-98,103-106} [src/components/window.tsx]

- `WindowActions` calls `useNotes` and `useToast`, so it must render inside `NotesProvider` and `ToastProvider`. It is a prop of the window, so the providers now wrap the window instead of sitting inside it. `Window` creates the toast overlay's ref for `ToastProvider`, and `NotesWindow` renders the overlay with it.
- `NavigationContainer` takes `navigationRef`, which `openNote` navigates through.
- The Notes screen's options fill its header bar: `headerTitle` replaces the plain title with `NotesTitle`, `headerStart` adds the New Note button, and `headerEnd` holds the main menu. See [Headers](/v2/guide/navigation#headers).
- Both header buttons run actions through `actionName`, and follow them: the New Note button is unavailable while the folder loads, and the toggle button shows the preview action's state. The toggle no longer sets `preview` with `active` and `onNotifyActive`. Clicking it activates `win.preview`, which toggles the state as Ctrl+Shift+P does. See [Buttons](/v2/guide/actions#buttons).
- The tooltips name each button's key, since a header bar button has nowhere else to show it.
- `NotesWindow` keeps the `preview` state, which `WindowActions` and `NoteNavigation` share, and the `dialog` state for [Mount the dialogs](#mount-the-dialogs).

`NotesTitle`, in `src/components/notes-screen.tsx`, shows the note count under the title, and the empty folder's status page gets a New Note button:

<<< @/figures/tutorial/actions-menus-shortcuts/src/components/notes-screen.tsx{5,8,94-108,133-140,217} [src/components/notes-screen.tsx]

- [`AdwWindowTitle`](https://gnome.pages.gitlab.gnome.org/libadwaita/doc/1-latest/class.WindowTitle.html) shows a title with a subtitle under it. The subtitle stays empty while the folder loads.
- `t()` receives the singular and the plural source strings in `defaultValue_one` and `defaultValue_other`, and `count` picks one. [Translate the App](/v2/tutorial/internationalization) translates both. See [Plurals and context](/v2/guide/internationalization#plurals-and-context).
- The `pill` and `suggested-action` [style classes](https://gnome.pages.gitlab.gnome.org/libadwaita/doc/1-latest/style-classes.html#pill) give the status page's button its rounded, accent-colored look.

## Keyboard shortcuts

`actionAccels` on the application element binds keys to actions by their prefixed names, and the application's own `quit` action becomes `app.quit`. `src/app.tsx` now holds only the application element:

<<< @/figures/tutorial/actions-menus-shortcuts/src/app.tsx{1-2,4,8-23} [src/app.tsx]

- Ctrl+N, Ctrl+? and Ctrl+Q are the [standard GNOME keys](https://developer.gnome.org/hig/reference/keyboard.html) for New, Keyboard Shortcuts and Quit. `<Control>question` is GTK's name for Ctrl+?.
- A key for a `win.` action works in every window that has the action. Menus read the same table and show each key beside its item. See [Keyboard accelerators](/v2/guide/actions#keyboard-accelerators).
- `quit()` from `@gtkx/react` ends the app, as closing the window does.

`src/components/shortcuts.tsx` lists the keys in an `AdwShortcutsDialog`:

<<< @/figures/tutorial/actions-menus-shortcuts/src/components/shortcuts.tsx [src/components/shortcuts.tsx]

- An item with an `actionName` shows that action's keys from `actionAccels`, so changing a key in `src/app.tsx` updates the dialog too.
- Ctrl+F belongs to no action: the `FocusShortcut` controller from [Focus search with Ctrl+F](/v2/tutorial/search-in-a-worker#focus-search-with-ctrl-f) handles it. Its item names the keys with `accelerator`.
- The items describe shortcuts and don't register them. See [The shortcuts dialog](/v2/guide/actions#the-shortcuts-dialog).

## Mount the dialogs

Which dialog is open is React state. `NotesWindow` keeps a `dialog` value that the Keyboard Shortcuts and About actions set, and `src/components/dialogs.tsx` renders the matching dialog:

<<< @/figures/tutorial/actions-menus-shortcuts/src/components/dialogs.tsx [src/components/dialogs.tsx]

<<< @/figures/tutorial/actions-menus-shortcuts/src/components/about.tsx [src/components/about.tsx]

- A dialog presents itself over the window when it mounts and closes when it unmounts. Its close button and Escape call `onClosed`, which sets `dialog` back to `none`. Without `onClosed` the dialog would stay open. See [Dialogs](/v2/guide/modals-and-portals#dialogs).
- `Dialog` is a union keyed by `kind`, so a dialog can carry data: [Rename, Trash, and Undo](/v2/tutorial/trash-and-toasts) adds one that carries the name of the note to rename.
- The about dialog's visible text goes through `t()`. [`AdwAboutDialog`](https://gnome.pages.gitlab.gnome.org/libadwaita/doc/1-latest/class.AboutDialog.html) lists its other properties, and [About dialog metadata](/v2/guide/modals-and-portals#about-dialog-metadata) covers its credit and legal sections.

## Run it

Press Ctrl+N. An Untitled note opens in the editor, and the sidebar title counts one more note. Open the main menu: New Note and Keyboard Shortcuts show their keys. Ctrl+Shift+P switches to the preview and back, and the eye button follows. Ctrl+? opens the shortcuts dialog, and Ctrl+Q quits.

<figure class="result">
    <img class="result-light" src="/figures/tutorial-actions-menus-shortcuts-light.png" width="720" height="480" loading="lazy" alt="The Notes window with an empty Untitled note open and listed first in the sidebar, the sidebar title reading 6 notes, and the main menu open with New Note (Ctrl+N), Keyboard Shortcuts (Ctrl+?) and About Notes." />
    <img class="result-dark" src="/figures/tutorial-actions-menus-shortcuts-dark.png" width="720" height="480" loading="lazy" alt="The Notes window with an empty Untitled note open and listed first in the sidebar, the sidebar title reading 6 notes, and the main menu open with New Note (Ctrl+N), Keyboard Shortcuts (Ctrl+?) and About Notes." />
    <figcaption>Captured from <a href="#menus"><code>src/components/window.tsx</code></a> above, after Ctrl+N and with the main menu open.</figcaption>
</figure>

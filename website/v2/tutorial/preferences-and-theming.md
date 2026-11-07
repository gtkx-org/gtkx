---
description: "Store the notes folder, color scheme, preview state and window size in GSettings and edit them in a preferences dialog."
---

# Add Preferences

Keep the notes folder, color scheme, preview state and window size in GSettings so they survive a restart, and edit the folder and color scheme in a preferences dialog.

## A settings schema

GSettings stores each preference under a key, and a schema declares each key's type and default. A new file, `data/dev.gtkx.Notes.gschema.xml`, declares the app's keys:

<<< @/figures/tutorial/preferences-and-theming/data/dev.gtkx.Notes.gschema.xml [data/dev.gtkx.Notes.gschema.xml]

- The schema ID is the application ID, and `path` is the same ID written as a path. See [Your app's schema](/v2/guide/native-state#your-app-s-schema).
- An empty `folder` means `Notes` in the Documents folder, the default from [List the Notes](/v2/tutorial/the-notes-folder).
- `color-scheme` is a string limited to its `<choices>`. `default` follows the system style.
- `gettext-domain` names the catalog that translates the summaries and descriptions. See [Translate settings schemas](/v2/guide/internationalization#translate-settings-schemas).

A module that imports the schema is enough for GTKX to compile it and type its keys. `src/settings.tsx` imports it and shares one `Gio.Settings` instance with the app:

<<< @/figures/tutorial/preferences-and-theming/src/settings.tsx [src/settings.tsx]

- `SettingsProvider` renders a `GSettings` element through a portal, keeps the instance in state, and renders its children once the instance exists, so `useAppSettings` always returns one. [The settings instance](/v2/guide/native-state#the-settings-instance) explains the pattern.
- `schema.values["color-scheme"]` lists the key's choices, so `ColorScheme` is `"default" | "light" | "dark"`.
- `COLOR_SCHEMES` gives each choice a label and its [`Adw.ColorScheme`](https://gnome.pages.gitlab.gnome.org/libadwaita/doc/1-latest/enum.ColorScheme.html). As a `Record<ColorScheme, …>`, it fails to typecheck if the schema gains a choice without an entry. Each label is a function, so `t` translates it when the dialog renders.
- `colorSchemeItems` builds the items of the dialog's Style row, and `toColorScheme` turns the row's selected ID back into a choice, or `undefined` for any other string.

`SettingsProvider` wraps the window in `src/app.tsx`. Ctrl+, runs the `win.preferences` action from [The preferences dialog](#the-preferences-dialog), the [GNOME HIG](https://developer.gnome.org/hig/reference/keyboard.html)'s shortcut for Preferences:

<<< @/figures/tutorial/preferences-and-theming/src/app.tsx{5,17-20,29-31} [src/app.tsx]

## Read and bind settings

The window reads the folder and color scheme, and saves its size:

<<< @/figures/tutorial/preferences-and-theming/src/components/window.tsx{2,11-12,16,66,88-90,94-107,111,117,121,127,134-144,148} [src/components/window.tsx]

- `Window` reads `folder` and `color-scheme` with `useSetting`, which re-renders when a key changes. See [Reading and writing a key](/v2/guide/native-state#reading-and-writing-a-key).
- `key={folder}` remounts `NotesProvider` when the folder changes, so it reads and watches the new folder from scratch with a new saver. Everything inside the provider remounts with it, the window included: choosing a folder replaces the window and closes the Preferences dialog.
- The effect applies the color scheme with [`Adw.StyleManager`](https://gnome.pages.gitlab.gnome.org/libadwaita/doc/1-latest/property.StyleManager.color-scheme.html). Every Adwaita widget follows it, and so do media queries in the app's own styles. See [Follow appearance preferences](/v2/guide/css#follow-appearance-preferences).
- The `useBindSetting` calls keep `window-width` and `window-height` in step with the window's `defaultWidth` and `defaultHeight`, which GTK updates as the window is resized. They replace the fixed 720 by 480 from [Two screens in a split view](/v2/tutorial/the-note-editor#two-screens-in-a-split-view): the window opens at the size it had when it closed, and at 960 by 640 the first time. GNOME's [Saving and Loading Window State](https://developer.gnome.org/documentation/tutorials/save-state.html) describes the same bind. See [Binding a key to a property](/v2/guide/native-state#binding-a-key-to-a-property).
- The `ref` stores the window in state, so the binds wait until it exists.
- `Dialogs` receives `showError` from `useNoteCommands`, for the folder errors in [The preferences dialog](#the-preferences-dialog).

The preview state moves from the window to the `preview` key, so a note opens the way the last one was shown, even after a restart. `NoteScreen` and the `preview` action read the key with `useSetting`:

<<< @/figures/tutorial/preferences-and-theming/src/components/note-screen.tsx{6,12,14,16,19} [src/components/note-screen.tsx]

<<< @/figures/tutorial/preferences-and-theming/src/components/window-actions.tsx{5,8,50,59,62-66,98,102-105} [src/components/window-actions.tsx]

- `onChangeState` writes the key instead of the window's state, and the toggle button follows the action as before.
- With no state left to pass down, `NoteScreen` becomes the screen's `component` instead of a render callback, which React Navigation [renders without its optimizations](https://reactnavigation.org/docs/hello-react-navigation/#passing-additional-data).
- `useNoteCommands` returns `showError` along with the commands.

## The preferences dialog

The `win.preferences` action shows the preferences dialog. The main menu and the shortcuts dialog list it:

<<< @/figures/tutorial/preferences-and-theming/src/components/main-menu.tsx{20-23} [src/components/main-menu.tsx]

<<< @/figures/tutorial/preferences-and-theming/src/components/shortcuts.tsx{12-15} [src/components/shortcuts.tsx]

The `Dialog` union gains a `preferences` kind, and `Dialogs` passes the window's `onError` to the dialog:

<<< @/figures/tutorial/preferences-and-theming/src/components/dialogs.tsx{2,10,17,20,28-30} [src/components/dialogs.tsx]

`src/components/preferences.tsx` holds the dialog:

<<< @/figures/tutorial/preferences-and-theming/src/components/preferences.tsx [src/components/preferences.tsx]

- [`AdwPreferencesDialog`](https://gnome.pages.gitlab.gnome.org/libadwaita/doc/1-latest/class.PreferencesDialog.html) holds pages of grouped rows. Notes has one page, with an Appearance group and a Storage group. `onClosed` clears the dialog state, as for the other dialogs. See [Dialogs](/v2/guide/modals-and-portals#dialogs).
- `ComboRow` from `@gtkx/components` renders the Style row. `selectedId` shows the key's value, and `onSelectionChanged` writes the chosen one, which the window's effect then applies. The ID arrives as a plain string, and `toColorScheme` checks it against the schema's choices without a cast. See [DropDown](/v2/guide/components#dropdown).
- `FolderRow` keeps a `GtkFileDialog` in state through a portal and awaits its `selectFolder`, as [Awaiting async operations](/v2/guide/async-operations#awaiting-async-operations) shows. `useParentWindow` returns the Notes window, so the file dialog opens over it. See [Finding the parent window](/v2/guide/modals-and-portals#finding-the-parent-window).
- Closing the file dialog rejects with `Gtk.DialogError.DISMISSED`, which `isDismissal` ignores. Other failures reach the window's error toast through `onError`. A folder without a local path, for which `getPath` returns `null`, is ignored.
- Once a folder is chosen, a second button sets the key back to empty, which returns to the default folder.
- The row's subtitle shows the folder in use. `displayFolder`, a new function in `src/notes/files.ts`, writes the home folder as `~`:

<<< @/figures/tutorial/preferences-and-theming/src/notes/files.ts{24-28,148} [src/notes/files.ts]

## Run it

Open Preferences with Ctrl+, and choose Dark: the window turns dark at once. Choose another notes folder: the window opens again on that folder's notes, and Preferences closes. Toggle the preview, resize the window and quit. The app opens again with the same style, folder, preview state and size.

<figure class="result">
    <img class="result-light" src="/figures/tutorial-preferences-and-theming-light.png" width="720" height="480" loading="lazy" alt="The Notes window with the Preferences dialog open: an Appearance group with a Style row set to Light, and a Storage group with a Notes Folder row showing ~/Notes and a folder button." />
    <img class="result-dark" src="/figures/tutorial-preferences-and-theming-dark.png" width="720" height="480" loading="lazy" alt="The Notes window with the Preferences dialog open: an Appearance group with a Style row set to Dark, and a Storage group with a Notes Folder row showing ~/Notes and a folder button." />
    <figcaption>Captured from <a href="#the-preferences-dialog"><code>src/components/preferences.tsx</code></a> above, opened from the main menu.</figcaption>
</figure>

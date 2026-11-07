---
description: "Store the notes folder, color scheme and window size in GSettings and edit them in a preferences dialog."
---

# Add Preferences

Keep the notes folder, color scheme, preview state and window size in GSettings, and edit them in a preferences dialog.

::: info Being written
This chapter belongs to the Notes tutorial for GTKX 2.0 and is not written yet. The headings below are its plan; the [finished app](https://github.com/gtkx-org/gtkx/tree/main/tutorial) already contains the code.
:::

## A settings schema

`data/dev.gtkx.Notes.gschema.xml` declares a key for each preference, with its type and default: the notes folder (empty for the default folder), the color scheme, whether notes open in the preview, and the window size. Importing the schema from a module is enough for GTKX to compile it and type its keys. See [Settings schemas](/v2/guide/assets#settings-schemas).

<<< @/figures/tutorial/preferences-and-theming/data/dev.gtkx.Notes.gschema.xml [data/dev.gtkx.Notes.gschema.xml]

`settings.tsx` renders a `GSettings` element through a portal and shares the instance through a context, as [The settings instance](/v2/guide/native-state#the-settings-instance) shows. `COLOR_SCHEMES` gives each `color-scheme` choice a label and its `Adw.ColorScheme`.

<<< @/figures/tutorial/preferences-and-theming/src/settings.tsx [src/settings.tsx]

`SettingsProvider` wraps the window, and Ctrl+, opens the preferences dialog below.

<<< @/figures/tutorial/preferences-and-theming/src/app.tsx{5,17-20,29-31} [src/app.tsx]

## Read and bind settings

`Window` reads the `folder` and `color-scheme` keys with `useSetting`. An empty folder means the default one, and `key={folder}` remounts `NotesProvider` when the folder changes, so it loads the new folder from scratch. An effect applies the color scheme to `Adw.StyleManager`. Two `useBindSetting` calls replace Create a Window's `defaultWidth` and `defaultHeight`: the window opens at the size it had when it closed, 960 by 640 the first time. See [Binding a key to a property](/v2/guide/native-state#binding-a-key-to-a-property).

<<< @/figures/tutorial/preferences-and-theming/src/components/window.tsx{2,11-12,16,66,88-90,94-107,111,117,121,127,134-148} [src/components/window.tsx]

The preview state moves from the window to the `preview` key, so it survives a restart. The `preview` action and `NoteScreen` read it with `useSetting`, and `NoteScreen` becomes the screen's `component` instead of a render function that passed the state down.

<<< @/figures/tutorial/preferences-and-theming/src/components/note-screen.tsx{6,12,14-16,19} [src/components/note-screen.tsx]

<<< @/figures/tutorial/preferences-and-theming/src/components/window-actions.tsx{5,8,50,54-59,62-66,98,102-105} [src/components/window-actions.tsx]

## The preferences dialog

A `win.preferences` action opens `Preferences`. The main menu and the shortcuts dialog list it, and Ctrl+, runs it. It's an `AdwPreferencesDialog` with a `ComboRow` for the color scheme (see [DropDown](/v2/guide/components#dropdown)) and a row for the notes folder. See [Dialogs](/v2/guide/modals-and-portals#dialogs).

<<< @/figures/tutorial/preferences-and-theming/src/components/main-menu.tsx{20-23} [src/components/main-menu.tsx]

<<< @/figures/tutorial/preferences-and-theming/src/components/shortcuts.tsx{12-15} [src/components/shortcuts.tsx]

<<< @/figures/tutorial/preferences-and-theming/src/components/dialogs.tsx{2,10,17,20,28-30} [src/components/dialogs.tsx]

The folder row's button awaits a `GtkFileDialog`'s `selectFolder`, as [Awaiting async operations](/v2/guide/async-operations#awaiting-async-operations) shows. Closing the file dialog isn't an error; other failures reach the window's error toast through `onError`. Once a folder is chosen, a second button puts the default back. The row shows the folder with `~` for the home folder.

<<< @/figures/tutorial/preferences-and-theming/src/components/preferences.tsx [src/components/preferences.tsx]

<<< @/figures/tutorial/preferences-and-theming/src/notes/files.ts{24-28,148} [src/notes/files.ts]

## Run it

Open Preferences (Ctrl+,) and choose Dark: the window switches at once. Choose another notes folder and the list shows its notes. Toggle the preview, resize the window and quit; the app opens again with the same style, folder, preview state and size.

<figure class="result">
    <img class="result-light" src="/figures/tutorial-preferences-and-theming-light.png" width="720" height="480" loading="lazy" alt="The Notes window with the Preferences dialog open: an Appearance group with a Style row set to Light, and a Storage group with a Notes Folder row showing ~/Notes and a folder button." />
    <img class="result-dark" src="/figures/tutorial-preferences-and-theming-dark.png" width="720" height="480" loading="lazy" alt="The Notes window with the Preferences dialog open: an Appearance group with a Style row set to Dark, and a Storage group with a Notes Folder row showing ~/Notes and a folder button." />
    <figcaption>Captured from <a href="#the-preferences-dialog"><code>src/components/preferences.tsx</code></a> above, opened from the main menu.</figcaption>
</figure>

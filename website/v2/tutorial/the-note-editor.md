---
description: "Open notes in a GtkSourceView editor with Markdown highlighting, inside a split view."
---

# Edit a Note

Generate bindings for GtkSourceView, a library outside the default set, and open the selected note in a Markdown editor beside the list.

::: info Being written
This chapter belongs to the Notes tutorial for GTKX 2.0 and is not written yet. The headings below are its plan; the [finished app](https://github.com/gtkx-org/gtkx/tree/main/tutorial) already contains the code.
:::

## Add GtkSourceView

`libraries: ["GtkSource-5"]` in `gtkx.config.ts` generates `@gtkx/gi/gtksource` and `@gtkx/jsx/gtksource`. See [The config file](/v2/guide/configuration-and-codegen#the-config-file).

## Two screens in a split view

`createSplitViewNavigator` from `@gtkx/navigation` puts the note list in the sidebar and the open note in the content pane, with a placeholder when no note is open. See [Split view navigator](/v2/guide/navigation#split-view-navigator).

<<< @/figures/tutorial/the-note-editor/src/navigation.ts [src/navigation.ts]

The window holds the navigator inside the provider, sized wide enough that the split view does not collapse.

<<< @/figures/tutorial/the-note-editor/src/app.tsx [src/app.tsx]

## Select the open note

The list's selection follows the current route, so the highlighted row always matches the open note.

<<< @/figures/tutorial/the-note-editor/src/components/notes-screen.tsx [src/components/notes-screen.tsx]

## The editor

`GtkSourceView` with a Markdown `GtkSourceBuffer`; `useProperty` follows the dark style to pick the Adwaita or Adwaita-dark scheme. See [Following a property](/v2/guide/native-state#following-a-property).

<<< @/figures/tutorial/the-note-editor/src/editor/note-editor.tsx [src/editor/note-editor.tsx]

The note screen looks up the note named in the route and opens it in the editor.

<<< @/figures/tutorial/the-note-editor/src/components/note-screen.tsx [src/components/note-screen.tsx]

## Run it

Click a note in the list. Its Markdown opens beside the list with syntax highlighting, in the dark scheme when the system prefers dark. Edits stay in the editor until the next chapter saves them.

<figure class="result">
    <img class="result-light" src="/figures/tutorial-the-note-editor-light.png" width="720" height="480" loading="lazy" alt="The Notes window split in two: the sidebar lists five notes with Website relaunch selected, and the content pane, titled Website relaunch, shows its Markdown with highlighted headings, bold text, a link and a numbered list." />
    <img class="result-dark" src="/figures/tutorial-the-note-editor-dark.png" width="720" height="480" loading="lazy" alt="The Notes window split in two: the sidebar lists five notes with Website relaunch selected, and the content pane, titled Website relaunch, shows its Markdown with highlighted headings, bold text, a link and a numbered list." />
    <figcaption>Captured from <a href="#two-screens-in-a-split-view"><code>src/app.tsx</code></a> above, after clicking Website relaunch.</figcaption>
</figure>

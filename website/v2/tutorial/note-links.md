---
description: "Implement a GtkSourceView completion provider in TypeScript to suggest links to other notes."
---

# Complete Note Links

Implement the `GtkSource.CompletionProvider` interface in a TypeScript class that suggests links to other notes as you type.

::: info Being written
This chapter belongs to the Notes tutorial for GTKX 2.0 and is not written yet. The headings below are its plan; the [finished app](https://github.com/gtkx-org/gtkx/tree/main/tutorial) already contains the code.
:::

## Implement a GObject interface

`note-link-provider.ts` registers two GObject classes with `registerClass`. `NoteLinkProposal` implements [`GtkSource.CompletionProposal`](https://gnome.pages.gitlab.gnome.org/gtksourceview/gtksourceview5/iface.CompletionProposal.html) and holds one note name. `NoteLinkProvider` implements [`GtkSource.CompletionProvider`](https://gnome.pages.gitlab.gnome.org/gtksourceview/gtksourceview5/iface.CompletionProvider.html): each interface method is a `vfunc` method on the class, checked by the generated `Impl` type. See [Implementing an interface](/v2/guide/subclassing#implementing-an-interface).

<<< @/figures/tutorial/note-links/src/editor/note-link-provider.ts [src/editor/note-link-provider.ts]

## Offer note names

`vfuncIsTrigger` opens the completion when the second `[` of `[[` is typed. `openLinkAt` finds the open `[[` on the cursor's line and the query typed after it.

`proposals` keeps the names that contain the query, ignoring case, with names that start with it first. GtkSourceView populates asynchronously: `vfuncPopulateAsync` hands the model back through a `Gio.Task`, and `vfuncPopulateFinish` takes it out. As you keep typing, `vfuncRefilter` narrows the same model.

`vfuncDisplay` fills each row with an icon and the name. `vfuncActivate` replaces `[[` and the query with a Markdown link to the note's file, such as `[Recipes](<Recipes.md>)`, in one user action, so a single undo takes it back.

## Attach it to the editor

`NoteScreen` passes the names of the other notes to the editor as `linkTargets`. Its `openLinkedNote` now uses `openNote` from [Window actions](/v2/tutorial/actions-menus-shortcuts#window-actions), so it no longer needs the screen's `navigation`.

<<< @/figures/tutorial/note-links/src/components/note-screen.tsx{7-8,15-23,25,31-34,54} [src/components/note-screen.tsx]

`NoteEditor` keeps the `GtkSourceView` in state through its callback ref, as [Objects that JSX creates](/v2/guide/native-state#objects-that-jsx-creates) shows. `useLinkCompletion` adds one provider to the view's completion once the view exists and removes it on unmount. The provider reads the names through a ref, so a new list of notes reaches it without adding it again. `selectOnShow` selects the first proposal, so Enter inserts it.

<<< @/figures/tutorial/note-links/src/editor/note-editor.tsx{8-9,13-43,49-50,55} [src/editor/note-editor.tsx]

## Run it

Open Book club and type `[[` on a new line: a popup lists the other notes. Type `re` to narrow it to Recipes and Website relaunch, and press Enter to insert the link. Switch to the preview and click the link to open Recipes.

<figure class="result">
    <img class="result-light" src="/figures/tutorial-note-links-light.png" width="720" height="480" loading="lazy" alt="The Notes window editing Book club, with [[ typed on the last line and a completion popup below it listing Meeting notes, Recipes, Trip to Lisbon and Website relaunch, the first one selected." />
    <img class="result-dark" src="/figures/tutorial-note-links-dark.png" width="720" height="480" loading="lazy" alt="The Notes window editing Book club, with [[ typed on the last line and a completion popup below it listing Meeting notes, Recipes, Trip to Lisbon and Website relaunch, the first one selected." />
    <figcaption>Captured from <a href="#attach-it-to-the-editor"><code>src/editor/note-editor.tsx</code></a> above, after typing <code>[[</code> in Book club.</figcaption>
</figure>

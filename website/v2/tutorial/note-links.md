---
description: "Implement a GtkSourceView completion provider in TypeScript to suggest links to other notes."
---

# Complete Note Links

Type `[[` in the editor to pick another note from a popup and insert a Markdown link to it. GtkSourceView shows the popup and handles the keyboard; the app supplies the suggestions from a TypeScript class that implements a GtkSourceView interface.

## Implement a GObject interface

GtkSourceView asks completion providers for suggestions, called proposals. A provider is a GObject that implements the [`GtkSource.CompletionProvider`](https://gnome.pages.gitlab.gnome.org/gtksourceview/gtksourceview5/iface.CompletionProvider.html) interface, and each proposal is a GObject that implements [`GtkSource.CompletionProposal`](https://gnome.pages.gitlab.gnome.org/gtksourceview/gtksourceview5/iface.CompletionProposal.html). A new file, `src/editor/note-link-provider.ts`, defines both:

<<< @/figures/tutorial/note-links/src/editor/note-link-provider.ts [src/editor/note-link-provider.ts]

- `registerClass` registers each class as a native GObject type, with the interface in `implements`. Each interface method is a `vfunc` method on the class, and the generated `Impl` type, such as `GtkSource.CompletionProviderImpl`, checks its signature. See [Implementing an interface](/v2/guide/subclassing#implementing-an-interface).
- `NoteLinkProposal` holds one note name in a plain field, and `vfuncGetTypedText` returns it as the proposal's text.
- `NoteLinkProvider` reads the names to offer from its `noteNames` function, which the editor replaces in [Attach it to the editor](#attach-it-to-the-editor).

## Offer note names

GtkSourceView calls `vfuncIsTrigger` when you type a character that can't be part of a word, such as `[`, and the provider opens the popup when that character is the second `[` of `[[`. `openLinkAt` finds the last `[[` before the cursor on its line and returns where it starts and the query typed after it, or `null` once a `]` closes it.

`proposals` keeps the names that contain the query, ignoring case, and sorts the names that start with it first, then alphabetically. The `Gio.ListStore` that holds them is created for the registered `NoteLinkProposal` type.

GtkSourceView requests proposals asynchronously: it calls `vfuncPopulateAsync` with a callback, and `vfuncPopulateFinish` once the callback runs. The names are already in memory, so `vfuncPopulateAsync` completes a [`Gio.Task`](https://docs.gtk.org/gio/class.Task.html) at once. The task's `returnValue` takes the model in a `GObject.Value` initialized for `Gio.ListStore`, as [Passing a GValue](/v2/guide/native-values#passing-a-gvalue) describes. `propagateValue` unpacks it typed as `unknown`, so `vfuncPopulateFinish` checks that it is a `Gio.ListStore` before returning it.

As you keep typing, GtkSourceView calls `vfuncRefilter` with the same model, and the provider replaces its contents with the proposals for the longer query.

`vfuncDisplay` fills each row of the popup with a document icon and the note's name. `vfuncActivate` runs when you choose a proposal. It replaces `[[` and the query with a Markdown link to the note's file, such as `[Recipes](<Recipes.md>)`:

- The angle brackets allow spaces in the file name, and `escape` adds a backslash before the characters that would end the link text or the file name early.
- `beginUserAction` and `endUserAction` group the deletion and the insertion, so a single undo restores what you typed.

## Attach it to the editor

`NoteScreen` passes the names of the other notes to the editor as `linkTargets`. `useMemo` builds the list again only when the notes or the open note change. `openLinkedNote` moves out of the component and calls `openNote` from [Window actions](/v2/tutorial/actions-menus-shortcuts#window-actions), so the screen no longer needs its `navigation` prop:

<<< @/figures/tutorial/note-links/src/components/note-screen.tsx{7-8,13-20,22-23,25,31-34,54} [src/components/note-screen.tsx]

`NoteEditor` keeps the `GtkSourceView` in state through its callback ref, as [Objects that JSX creates](/v2/guide/native-state#objects-that-jsx-creates) shows, and passes it to `useLinkCompletion`:

<<< @/figures/tutorial/note-links/src/editor/note-editor.tsx{8-9,13-17,19-43,49-50,55} [src/editor/note-editor.tsx]

- Once the view exists, the second effect adds a provider to the view's completion, and its cleanup removes the provider when the editor unmounts.
- The provider reads the names through `latestTargets`, a ref that the first effect keeps current. A new list of notes reaches the provider without replacing it.
- [`selectOnShow`](https://gnome.pages.gitlab.gnome.org/gtksourceview/gtksourceview5/property.Completion.select-on-show.html) selects the first proposal when the popup opens, so Enter inserts it.

## Run it

Open Book club and type `[[` on a new line: a popup lists the other notes, with the first one selected. Type `re` to narrow it to Recipes and Website relaunch, and press Enter to insert a link to Recipes. Press Ctrl+Z and the link turns back into `[[re`. Insert it again, switch to the preview and click the link to open Recipes.

<figure class="result">
    <img class="result-light" src="/figures/tutorial-note-links-light.png" width="720" height="480" loading="lazy" alt="The Notes window editing Book club, with [[ typed on the last line and a completion popup below it listing Meeting notes, Recipes, Trip to Lisbon and Website relaunch, the first one selected." />
    <img class="result-dark" src="/figures/tutorial-note-links-dark.png" width="720" height="480" loading="lazy" alt="The Notes window editing Book club, with [[ typed on the last line and a completion popup below it listing Meeting notes, Recipes, Trip to Lisbon and Website relaunch, the first one selected." />
    <figcaption>Captured from <a href="#attach-it-to-the-editor"><code>src/editor/note-editor.tsx</code></a> above, after typing <code>[[</code> in Book club.</figcaption>
</figure>

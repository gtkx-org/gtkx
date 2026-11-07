---
description: "Change the preview renderer while the app runs and keep the open note and its state."
---

# Develop with Fast Refresh

Restyle the preview while a note stays open, and see what Fast Refresh keeps and when the app restarts instead.

## What Fast Refresh keeps

`npm run dev` watches the project's source files. When you save a component module, Fast Refresh runs the new code and renders its components again in the open window. Everything else stays as it was: React state such as the navigator's open note and the preview toggle in `App`, and the GTK widgets the edit didn't change, such as the editor with its cursor and undo history.

`src/preview/markdown-preview.tsx` exports only `MarkdownPreview`, and its other components are private to the module, so a save refreshes it in place. Saving a module that exports something other than components, such as `toMarkup` in `markup.ts`, refreshes the components that import it. The terminal prints `Running Fast Refresh...` and `Fast Refresh complete` for each save.

## Restyle the preview

Open a note with a quote and a code block. If your folder has none, save this as `Meeting notes.md` in it:

````md
# Meeting notes

Kickoff with design and docs, Tuesday 10:00.

> Launch when the content is ready, not before.

Preview the new site locally:

```sh
npm install
npm run docs:dev
```
````

The preview renders the quote as dimmed text and the code block as a plain monospace label. Change `CodeBlock` and `QuoteBlock` in `src/preview/markdown-preview.tsx`, saving after each:

<<< @/figures/tutorial/fast-refresh/src/preview/markdown-preview.tsx{73-103} [src/preview/markdown-preview.tsx]

- `CodeBlock` puts the label in a box with the [`card`](https://gnome.pages.gitlab.gnome.org/libadwaita/doc/1-latest/style-classes.html#boxed-lists-cards) style class, which gives it the rounded background of a boxed list. The margins keep the code clear of the card's edge, and `hexpand` makes the card as wide as the text column.
- `QuoteBlock` sets a vertical [`GtkSeparator`](https://docs.gtk.org/gtk4/class.Separator.html) beside the quote's blocks, as a bar. The module already imports `GtkSeparator` for thematic breaks.

## When the app restarts

Some edits can't be applied to the running app, so `gtkx dev` relaunches it, and its state starts over: no note is open and the preview is off. The most common one is a change to which modules a file imports. Importing a module the file didn't import before, or dropping one, prints `Module imports changed: <path>` and `Full restart (process restart)`. Adding a name to an import the file already has, such as another element from `@gtkx/jsx/gtk`, refreshes as usual.

A component whose hook calls change, for example one that gains a `useState`, is mounted again with the components inside it, and they lose their state while the rest of the window keeps its own. [The app restarts instead of refreshing](/v2/guide/troubleshooting#the-app-restarts-instead-of-refreshing) lists every edit that restarts the app.

## Run it

With `npm run dev` running, open Meeting notes and press the eye button in its header bar. Save each change to `markdown-preview.tsx`: the code block moves into a card, the quote gets its bar, and the note stays open in the preview.

<figure class="result">
    <img class="result-light" src="/figures/tutorial-fast-refresh-light.png" width="720" height="480" loading="lazy" alt="The Notes window with Meeting notes shown as a rendered preview: a dimmed quote with a bar beside it and a code block with two npm commands in a card." />
    <img class="result-dark" src="/figures/tutorial-fast-refresh-dark.png" width="720" height="480" loading="lazy" alt="The Notes window with Meeting notes shown as a rendered preview: a dimmed quote with a bar beside it and a code block with two npm commands in a card." />
    <figcaption>Captured from <a href="#restyle-the-preview"><code>src/preview/markdown-preview.tsx</code></a> above, after opening Meeting notes and turning on the preview.</figcaption>
</figure>

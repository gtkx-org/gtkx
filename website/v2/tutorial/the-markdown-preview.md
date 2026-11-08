---
description: "Parse Markdown with an npm package and render the syntax tree as native GTK widgets."
---

# Render the Preview

Parse each note with `mdast-util-from-markdown` and render its syntax tree as GTK widgets, so the preview is native text that follows the system style.

## Parse Markdown

Install the parser and the types of the tree it returns:

```bash
npm install mdast-util-from-markdown
npm install -D @types/mdast
```

`fromMarkdown` turns a note's text into an [mdast](https://github.com/syntax-tree/mdast) syntax tree: a root node whose children are blocks, such as headings, paragraphs and lists, which hold inline nodes, such as text, emphasis and links. It is an ordinary npm package, running in the app's Node.js process like the file APIs.

The list's excerpt has shown the first line as written, so Book club reads `Next up: *Piranesi*` with its asterisks. Removing the syntax with regular expressions would miss links, escapes and nested formatting, while the tree holds the text without it. `src/notes/note.ts` now takes the excerpt from the tree:

<<< @/figures/tutorial/the-markdown-preview/src/notes/note.ts [src/notes/note.ts]

- `firstParagraph` walks the tree depth first and returns the first paragraph's text, including one inside a list item or a block quote. It skips headings, which usually repeat the note's name, and code blocks, which aren't paragraphs.
- `plainText` joins a paragraph's inline nodes: emphasis and links give their children's text, inline code its code, an image its description, and a line break a space.

## Map nodes to widgets

Inline formatting becomes [Pango markup](https://docs.gtk.org/Pango/pango_markup.html), the tags a `GtkLabel` renders when `useMarkup` is set. A new folder, `src/preview/`, holds the conversion in `markup.ts`:

<<< @/figures/tutorial/the-markdown-preview/src/preview/markup.ts [src/preview/markup.ts]

- [`GLib.markupEscapeText`](https://docs.gtk.org/glib/func.markup_escape_text.html) escapes the note's own text, so a `<` or `&` in a note shows as written instead of breaking the markup. Inline HTML shows as text too.
- A link becomes an `<a href>` tag, which the label underlines and makes clickable.
- `fromMarkdown` follows [CommonMark](https://spec.commonmark.org/), so GitHub's strikethrough, tables and task lists stay as text. `@types/mdast` also types the nodes of those extensions, such as `delete` and `footnoteReference`. The `switch` handles every inline type it lists, and the `string` return type makes TypeScript report any it misses.

`src/preview/markdown-preview.tsx` renders the blocks:

<<< @/figures/tutorial/the-markdown-preview/src/preview/markdown-preview.tsx [src/preview/markdown-preview.tsx]

- `MarkdownPreview` parses the text in `useMemo`, so it parses again only when the text changes, and renders the root's children.
- `Block` picks a widget for each block node. Headings, paragraphs and HTML blocks are labels with markup, and a code block is a monospace label the user can select. A block quote and each list item render their own children, so lists and quotes nest. Other nodes, such as link definitions, render nothing.
- The labels take their look from libadwaita [style classes](https://gnome.pages.gitlab.gnome.org/libadwaita/doc/1-latest/style-classes.html): `title-1` to `title-4` and `heading` size the headings, `monospace` sets code in a fixed-width font, and `dimmed` lowers a quote's contrast. They follow the system's light and dark styles without any CSS.
- `AdwClamp` keeps lines a readable length in a wide window, and the scrolled window scrolls only vertically, since the labels wrap.
- `accessibleRole` tells screen readers what each widget is: the preview is a document named Preview, and headings are headings rather than plain labels. [Test the App](/v2/tutorial/testing) finds them by these roles.
- Every label reports an activated link through `onActivateLink`. Blocks nest to any depth, so `LinkContext` hands the handler down rather than passing it through every block's props; see React's [`createContext`](https://react.dev/reference/react/createContext).

## Switch between editor and preview

The note screen, `src/components/note-screen.tsx`, puts the editor and the preview in a [`GtkStack`](https://docs.gtk.org/gtk4/class.Stack.html), which shows one child at a time:

<<< @/figures/tutorial/the-markdown-preview/src/components/note-screen.tsx{12-16,42-59} [src/components/note-screen.tsx]

- Each child sits in a [`GtkStackPage`](/v2/guide/components#stack-pages), the object the stack keeps for it, and `visibleChildName` shows the page with that `name`. The crossfade animates the switch.
- Both pages stay mounted, so the editor keeps its cursor and undo history while the preview shows, and the preview follows every edit.
- `preview` arrives as a prop, next to the navigator's `route` and `navigation`.

The toggle button that sets `preview` belongs in the note's header bar, which the navigator builds from the screen's `options`, so the state lives in `src/app.tsx`:

<<< @/figures/tutorial/the-markdown-preview/src/app.tsx{10,13,23,56-71} [src/app.tsx]

- `headerEnd` puts the button at the end of the content pane's header bar; [Headers](/v2/guide/navigation#headers) lists the other header options. `active` and `onNotifyActive` keep the button and the state in step, as in [The JSX prop model](/v2/guide/jsx-elements#the-jsx-prop-model).
- The `Note` screen takes a function as its child instead of `component`, so it can pass `preview` along with the navigator's props; see React Navigation's [Passing additional data](https://reactnavigation.org/docs/hello-react-navigation#passing-additional-data).
- The state outlives each note, so the preview stays on when another note opens. [Add Menus and Shortcuts](/v2/tutorial/actions-menus-shortcuts) turns the button into a window action with a keyboard shortcut.

## Follow links

Website relaunch links to another note with `[kickoff](<Meeting notes.md>)`. A link like that should open the note in the app. `src/notes/files.ts` gains `linkedNoteName`, which turns a link into a note name:

<<< @/figures/tutorial/the-markdown-preview/src/notes/files.ts{20-29,70-77} [src/notes/files.ts]

- [`GLib.Uri.peekScheme`](https://docs.gtk.org/glib/type_func.Uri.peek_scheme.html) returns `null` for a relative link, one without a scheme such as `https:`.
- [`GLib.Uri.unescapeString`](https://docs.gtk.org/glib/type_func.Uri.unescape_string.html) decodes escapes such as `%20`, and returns `null` when the link escapes a `/`.
- A link into another folder gives `null`, and `noteName`, which the folder listing uses, accepts only a visible `.md` file.

`openLinkedNote` in the note screen above navigates to the linked note and returns `true`, which tells the label the link is handled. For any other link it returns `false`, and the label's default handler for [`activate-link`](https://docs.gtk.org/gtk4/signal.Label.activate-link.html) opens it in the app the system uses for it, such as the web browser. A link to a note the folder doesn't have shows Note Not Found.

## Run it

Save the files. The new imports restart the app. The excerpts in the list now show text without Markdown syntax.

Open a note and press the eye button in its header bar: the note shows as headings, formatted paragraphs and lists. Activate a link to another note to open it.

<figure class="result">
    <img class="result-light" src="/figures/tutorial-the-markdown-preview-light.png" width="720" height="480" loading="lazy" alt="The Notes window with Website relaunch shown as a rendered preview: a large title, a paragraph with bold text and a kickoff link, a Milestones heading and a numbered list." />
    <img class="result-dark" src="/figures/tutorial-the-markdown-preview-dark.png" width="720" height="480" loading="lazy" alt="The Notes window with Website relaunch shown as a rendered preview: a large title, a paragraph with bold text and a kickoff link, a Milestones heading and a numbered list." />
    <figcaption>Captured from <a href="#switch-between-editor-and-preview"><code>src/app.tsx</code></a> above, after opening Website relaunch and turning on the preview.</figcaption>
</figure>

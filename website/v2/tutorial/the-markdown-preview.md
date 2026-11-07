---
description: "Parse Markdown with an npm package and render the syntax tree as native GTK widgets."
---

# Render the Preview

Parse each note with `mdast-util-from-markdown` and render its syntax tree as GTK widgets, so the preview is native text that follows the system style.

::: info Being written
This chapter belongs to the Notes tutorial for GTKX 2.0 and is not written yet. The headings below are its plan; the [finished app](https://github.com/gtkx-org/gtkx/tree/main/tutorial) already contains the code.
:::

## Parse Markdown

Install `mdast-util-from-markdown` and `@types/mdast`; `fromMarkdown` turns a note into an [mdast](https://github.com/syntax-tree/mdast) syntax tree. The list's excerpt now comes from the tree's first paragraph, so it shows text without Markdown syntax.

<<< @/figures/tutorial/the-markdown-preview/src/notes/note.ts [src/notes/note.ts]

## Map nodes to widgets

`MarkdownPreview` renders headings, paragraphs, lists, block quotes, code and rules as GTK widgets, and inline formatting as Pango markup. It follows CommonMark: tables, strikethrough and task lists stay as text.

<<< @/figures/tutorial/the-markdown-preview/src/preview/markup.ts [src/preview/markup.ts]

<<< @/figures/tutorial/the-markdown-preview/src/preview/markdown-preview.tsx [src/preview/markdown-preview.tsx]

## Switch between editor and preview

A `GtkStack` crossfades between the editor and the preview. A toggle button in the note's header bar switches them; the app keeps its state and passes it to the note screen.

<<< @/figures/tutorial/the-markdown-preview/src/components/note-screen.tsx [src/components/note-screen.tsx]

<<< @/figures/tutorial/the-markdown-preview/src/app.tsx [src/app.tsx]

## Follow links

Links to other notes open them in the app; other links open in the default browser. `linkedNoteName` turns a relative link such as `<Meeting notes.md>` into a note name, and the note screen navigates to it.

<<< @/figures/tutorial/the-markdown-preview/src/notes/files.ts [src/notes/files.ts]

## Run it

Open a note and press the eye button in its header bar: the note shows as headings, formatted paragraphs and lists. Activate a link to another note to open it.

<figure class="result">
    <img class="result-light" src="/figures/tutorial-the-markdown-preview-light.png" width="720" height="480" loading="lazy" alt="The Notes window with Website relaunch shown as a rendered preview: a large title, a paragraph with bold text and a kickoff link, a Milestones heading and a numbered list." />
    <img class="result-dark" src="/figures/tutorial-the-markdown-preview-dark.png" width="720" height="480" loading="lazy" alt="The Notes window with Website relaunch shown as a rendered preview: a large title, a paragraph with bold text and a kickoff link, a Milestones heading and a numbered list." />
    <figcaption>Captured from <a href="#switch-between-editor-and-preview"><code>src/app.tsx</code></a> above, after opening Website relaunch and turning on the preview.</figcaption>
</figure>

---
description: "Read tags from YAML front matter and filter the note list with a drop-down."
---

# Filter by Tag

Read tags from each note's YAML front matter and filter the list by tag.

::: info Being written
This chapter belongs to the Notes tutorial for GTKX 2.0 and is not written yet. The headings below are its plan; the [finished app](https://github.com/gtkx-org/gtkx/tree/main/tutorial) already contains the code.
:::

## Parse front matter

Install `yaml`. A note that starts with a `---` block has front matter: `toNote` parses the block with `yaml`, reads its `tags` (a list or a single tag, with any leading `#` dropped), and keeps the rest of the file as `body`. The excerpt now comes from the body, and front matter that isn't valid YAML gives no tags.

<<< @/figures/tutorial/tags-and-front-matter/src/notes/note.ts{3,9-10,14-46,87,93-95} [src/notes/note.ts]

## Filter the list

A [`DropDown`](/v2/guide/components#dropdown) under the search entry lists every tag after "All Notes", and the list shows only notes that have the selected tag and match the search. The drop-down appears once a note has a tag, and the filter falls back to all notes when the selected tag disappears.

<<< @/figures/tutorial/tags-and-front-matter/src/components/notes-screen.tsx{1,23-52,100,121-124,133-140,149-156} [src/components/notes-screen.tsx]

## Show tags in the preview

The note screen passes the preview the note's body and tags, so the front matter block no longer shows as text.

<<< @/figures/tutorial/tags-and-front-matter/src/components/note-screen.tsx{55-56} [src/components/note-screen.tsx]

`MarkdownPreview` shows the tags above the body.

<<< @/figures/tutorial/tags-and-front-matter/src/preview/markdown-preview.tsx{159-168,173,179,198} [src/preview/markdown-preview.tsx]

## Run it

Add front matter to two notes, for example `Book club.md`:

```md
---
tags: [home, reading]
---
# Book club

Next up: *Piranesi* by Susanna Clarke.
```

Choose **#home** in the drop-down. The list narrows to the notes tagged home. Open Book club and switch to the preview: its tags show above the heading, and the front matter does not.

<figure class="result">
    <img class="result-light" src="/figures/tutorial-tags-and-front-matter-light.png" width="720" height="480" loading="lazy" alt="The Notes window with #home chosen in the tag drop-down, the sidebar listing Book club and Recipes, and Book club's preview showing #home and #reading above its heading." />
    <img class="result-dark" src="/figures/tutorial-tags-and-front-matter-dark.png" width="720" height="480" loading="lazy" alt="The Notes window with #home chosen in the tag drop-down, the sidebar listing Book club and Recipes, and Book club's preview showing #home and #reading above its heading." />
    <figcaption>Captured from <a href="#filter-the-list"><code>src/components/notes-screen.tsx</code></a> and <a href="#show-tags-in-the-preview"><code>src/preview/markdown-preview.tsx</code></a> above, with #home chosen and Book club open in the preview.</figcaption>
</figure>

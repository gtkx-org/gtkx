---
description: "Read tags from YAML front matter and filter the note list with a drop-down."
---

# Filter by Tag

Read tags from each note's YAML front matter and filter the list by tag.

## Parse front matter

Tags live in the note file itself, in a block of YAML between two `---` lines at the top, so the notes folder stays plain Markdown that any editor can open. Install [yaml](https://eemeli.org/yaml/) to parse the block; it ships its own types:

```sh
npm install yaml
```

`src/notes/note.ts` splits each file into its front matter and its body:

<<< @/figures/tutorial/tags-and-front-matter/src/notes/note.ts{3,9-10,14-46,87,93-95} [src/notes/note.ts]

- `FRONT_MATTER` matches only at the very start of the file: a `---` line, the YAML, and a closing `---` line. A file without the block has no tags, and its body is the whole text.
- `parse` throws on YAML it can't read. `parseYaml` turns the error into `null`, so a note with a broken block still loads, with no tags.
- `toTags` accepts a list (`tags: [home, reading]`) or a single tag (`tags: home`), removes duplicates, and skips values that aren't strings, such as `2026`, which YAML reads as a number. It also drops a leading `#`, so `home` and `#home` are the same tag. A `#` after a space starts a YAML comment, so a tag written with one must be quoted: `tags: "#home"`.
- `body` is the text after the block. The excerpt and the preview read it, while the editor, the saver and the search keep using the whole `text`.

## Filter the list

`src/components/notes-screen.tsx` adds a drop-down of tags under the search entry:

<<< @/figures/tutorial/tags-and-front-matter/src/components/notes-screen.tsx{1,23-52,100,121-124,133-140,149-156} [src/components/notes-screen.tsx]

- `allTags` collects the tags of every note once, sorted alphabetically.
- `TagFilter` renders a [`DropDown`](/v2/guide/components#dropdown) from `@gtkx/components`. Its items are "All Notes" followed by each tag. The values are strings, so the drop-down shows them as labels without a `renderItem`. Selection works by item ID, and "All Notes" takes the empty string, which no tag can be because `toTags` drops empty ones. The tooltip says what the drop-down is for, since it shows only the current choice.
- `selectedTag` is what the user chose, and `tag` is what the list uses. When the chosen tag no longer exists, for example after you edit it out of the last note that had it, `tag` falls back to all notes, and passing it as `selectedId` moves the drop-down back to "All Notes".
- The tag and the search apply together: a note shows when it has the tag and matches the query. The search indexes each note's whole text, front matter included, so searching for a tag name also finds its notes.
- The drop-down renders only when some note has a tag, so a folder without front matter looks as before. The search entry and the drop-down share a box, which takes over the entry's margins.

## Show tags in the preview

Until now the preview rendered the whole file, so a front matter block showed as a horizontal rule above a heading made of the YAML. The note screen now passes the preview the note's body and its tags:

<<< @/figures/tutorial/tags-and-front-matter/src/components/note-screen.tsx{55-56} [src/components/note-screen.tsx]

The editor still gets `note.text`, so the front matter stays editable.

`MarkdownPreview`, in `src/preview/markdown-preview.tsx`, shows the tags above the body:

<<< @/figures/tutorial/tags-and-front-matter/src/preview/markdown-preview.tsx{159-169,173,179,198} [src/preview/markdown-preview.tsx]

`Tags` renders a row of labels with libadwaita's `caption-heading` and `accent` [style classes](https://gnome.pages.gitlab.gnome.org/libadwaita/doc/1-latest/style-classes.html). The `tags` prop is optional and defaults to an empty list, which renders no row.

## Run it

Add front matter to a few notes. Give `Book club.md` a list:

```md
---
tags: [home, reading]
---
# Book club

Next up: *Piranesi* by Susanna Clarke.
```

and put a block with a single tag at the top of `Recipes.md`:

```md
---
tags: home
---
```

The drop-down appears under the search entry. Choose **#home**, and the list narrows to Book club and Recipes. Open Book club and switch to the preview: its tags show above the heading, and the front matter doesn't.

<figure class="result">
    <img class="result-light" src="/figures/tutorial-tags-and-front-matter-light.png" width="720" height="480" loading="lazy" alt="The Notes window with #home chosen in the tag drop-down, the sidebar listing Book club and Recipes, and Book club's preview showing #home and #reading above its heading." />
    <img class="result-dark" src="/figures/tutorial-tags-and-front-matter-dark.png" width="720" height="480" loading="lazy" alt="The Notes window with #home chosen in the tag drop-down, the sidebar listing Book club and Recipes, and Book club's preview showing #home and #reading above its heading." />
    <figcaption>Captured from <a href="#filter-the-list"><code>src/components/notes-screen.tsx</code></a> and <a href="#show-tags-in-the-preview"><code>src/preview/markdown-preview.tsx</code></a> above, with #home chosen and Book club open in the preview.</figcaption>
</figure>

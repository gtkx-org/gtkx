---
description: "Read tags from YAML front matter and filter the note list with a drop-down."
---

# Filter by Tag

Read tags from each note's YAML front matter and filter the list by tag.

::: info Being written
This chapter belongs to the Notes tutorial for GTKX 2.0 and is not written yet. The headings below are its plan; the [finished app](https://github.com/gtkx-org/gtkx/tree/main/tutorial) already contains the code.
:::

## Parse front matter

Install `yaml`; a leading `---` block supplies `tags`, and the rest of the file is the body the preview renders.

## Filter the list

A `DropDown` from `@gtkx/components` lists every tag, and the list shows notes that have the selected tag and match the search.

## Show tags in the preview

The preview shows a note's tags above its body.

## Run it

What to check in the running app.

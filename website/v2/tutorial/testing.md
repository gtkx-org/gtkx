---
description: "Test Notes headless with real files in a temporary folder."
---

# Test the App

Test the app's workflows headless against real files in a temporary folder, without mocks.

::: info Being written
This chapter belongs to the Notes tutorial for GTKX 2.0 and is not written yet. The headings below are its plan; the [finished app](https://github.com/gtkx-org/gtkx/tree/main/tutorial) already contains the code.
:::

## A temporary notes folder

Each test points the app at a fresh folder of fixture notes. The setup file runs before every test file: it sets `XDG_DATA_HOME` to a temporary directory before GTK starts, so moving a note to the trash never touches your own trash, and before each test it copies the fixtures into a new notes folder, resets the settings and points the `folder` key at it. See [Test data and settings](/v2/guide/testing#test-data-and-settings).

<<< @/figures/tutorial/testing/vitest.config.ts [vitest.config.ts]

<<< @/figures/tutorial/testing/tests/setup.ts [tests/setup.ts]

The fixtures are two notes in `tests/fixtures/`: `Groceries.md` with a heading and a list, and `Reading list.md` with a heading and a paragraph.

## Find widgets by role and name

`@gtkx/testing` queries find the list, the editor and the preview by their accessible roles and names, and tests read the notes folder to check what the app wrote. See [Finding widgets](/v2/guide/testing#finding-widgets).

<<< @/figures/tutorial/testing/tests/notes.test.tsx [tests/notes.test.tsx]

## Test the stories

`composeStories` renders the Storybook stories from the previous chapter as components, so the preview's tests reuse their Markdown. See [Reuse stories in native tests](/v2/guide/storybook#reuse-stories-in-native-tests).

<<< @/figures/tutorial/testing/tests/preview.test.tsx [tests/preview.test.tsx]

## Type into the editor

`userEvent.type` inserts one character per edit, as typing does, so GtkSourceView's completion opens after `[[` in the link completion test. See [Interacting and waiting](/v2/guide/testing#interacting-and-waiting).

## Run the tests

Install the [headless test dependencies](/v2/guide/testing#setup), then run `npm test`.

## Run it

```txt
 ✓ tests/preview.test.tsx (3 tests)
 ✓ tests/notes.test.tsx (21 tests)

 Test Files  2 passed (2)
      Tests  24 passed (24)
```

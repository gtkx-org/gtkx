---
description: "Test Notes headless with real files in a temporary folder."
---

# Test the App

Test the app's workflows headless against real files in a temporary folder, without mocks.

::: info Being written
This chapter belongs to the Notes tutorial for GTKX 2.0 and is not written yet. The headings below are its plan; the [finished app](https://github.com/gtkx-org/gtkx/tree/main/tutorial) already contains the code.
:::

## A temporary notes folder

Each test points the app at a fresh folder of fixture notes.

## Find widgets by role and name

`@gtkx/testing` queries find the list, the editor and the preview by their accessible roles and names. See [Testing](/v2/guide/testing).

## Type into the editor

`userEvent.type` inserts its text in one change, so a test that needs completion types one character per call.

## Run the tests

`npm test` runs the suite and the translation checks.

## Run it

What to check in the running app.

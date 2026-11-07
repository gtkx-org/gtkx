---
description: "Extract the app's messages into a gettext template and add a French translation."
---

# Translate the App

Extract the messages marked since the first chapter into a gettext template, add a French translation, and check it in a test.

::: info Being written
This chapter belongs to the Notes tutorial for GTKX 2.0 and is not written yet. The headings below are its plan; the [finished app](https://github.com/gtkx-org/gtkx/tree/main/tutorial) already contains the code.
:::

## Extract the messages

GTKX creates the template `po/dev.gtkx.Notes.pot` from every `t()` call. See [Internationalization](/v2/guide/internationalization).

## Add a translation

`po/LINGUAS` lists the locales, and `po/fr.po` holds the French catalog.

## Plurals

The note count in the sidebar uses plural forms.

## Test the translation

A test runs the built app in French.

## Run it

What to check in the running app.

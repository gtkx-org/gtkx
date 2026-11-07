---
description: "Collapse the split view on narrow windows and keep the window usable at phone size."
---

# Adapt the Layout

Collapse the split view into one pane on narrow windows, size the sidebar, and keep the window usable at phone size.

::: info Being written
This chapter belongs to the Notes tutorial for GTKX 2.0 and is not written yet. The headings below are its plan; the [finished app](https://github.com/gtkx-org/gtkx/tree/main/tutorial) already contains the code.
:::

## Collapse on narrow windows

`collapseCondition` folds the split view into one pane below 500sp, and the back button returns to the list.

## Size the sidebar

`sidebarWidthFraction`, `minSidebarWidth` and `maxSidebarWidth` bound the sidebar on wide windows.

## Set a minimum size

`widthRequest` and `heightRequest` keep the window at least 360 by 294, the size of a phone screen.

## Run it

What to check in the running app.

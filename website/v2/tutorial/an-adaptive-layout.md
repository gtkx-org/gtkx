---
description: "Collapse the split view on narrow windows and keep the window usable at phone size."
---

# Adapt the Layout

Collapse the split view into one pane on narrow windows, size the sidebar, and keep the window usable at phone size.

::: info Being written
This chapter belongs to the Notes tutorial for GTKX 2.0 and is not written yet. The headings below are its plan; the [finished app](https://github.com/gtkx-org/gtkx/tree/main/tutorial) already contains the code.
:::

## Collapse on narrow windows

`collapseCondition` folds the split view into one pane below 500sp, and the back button returns to the list. It takes a libadwaita breakpoint condition; see [Split view navigator](/v2/guide/navigation#split-view-navigator).

<<< @/figures/tutorial/an-adaptive-layout/src/app.tsx{40-43} [src/app.tsx]

## Size the sidebar

`sidebarWidthFraction`, `minSidebarWidth` and `maxSidebarWidth` bound the sidebar on wide windows.

## Fit a phone screen

`widthRequest` and `heightRequest` from [Create a Window](/v2/tutorial/your-first-window) keep the window at least 360 by 294, the size of a phone screen. Collapsed, the split view fits that width.

## Run it

Narrow the window until the sidebar and the note no longer sit side by side, then open Website relaunch. The note fills the window, and the back button in its header bar returns to the list.

<figure class="result">
    <img class="result-light" src="/figures/tutorial-an-adaptive-layout-light.png" width="360" height="480" loading="lazy" alt="The Notes window at 360 pixels wide, collapsed to one pane: Website relaunch open in the editor under a header bar with a back button." />
    <img class="result-dark" src="/figures/tutorial-an-adaptive-layout-dark.png" width="360" height="480" loading="lazy" alt="The Notes window at 360 pixels wide, collapsed to one pane: Website relaunch open in the editor under a header bar with a back button." />
    <figcaption>Captured from <a href="#collapse-on-narrow-windows"><code>src/app.tsx</code></a> above, with the window at 360 by 480 after opening Website relaunch.</figcaption>
</figure>

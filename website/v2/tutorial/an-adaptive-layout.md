---
description: "Collapse the split view on narrow windows and keep the window usable at phone size."
---

# Adapt the Layout

Show the note list and the open note one at a time in narrow windows, size the sidebar, and keep the window usable at phone size.

## Collapse on narrow windows

[Edit a Note](/v2/tutorial/the-note-editor) opens the window at 720 by 480, wide enough for the note list and the note side by side. On a phone, or in a window tiled to a third of a screen, there is no room for both. Add these props to `Split.Navigator` in `src/app.tsx`:

<<< @/figures/tutorial/an-adaptive-layout/src/app.tsx{40-43} [src/app.tsx]

`collapseCondition` takes a libadwaita [breakpoint condition](https://gnome.pages.gitlab.gnome.org/libadwaita/doc/1-latest/type_func.BreakpointCondition.parse.html). While the navigator is 500sp wide or narrower, the split view collapses: the note list fills the window, and selecting a note opens it in its place, with a back button in its header bar that returns to the list. Widen the window past 500sp and the panes sit side by side again, with the open note still selected.

An sp is a pixel at the default text size and grows with the Large Text setting ([`AdwLengthUnit`](https://gnome.pages.gitlab.gnome.org/libadwaita/doc/1-latest/enum.LengthUnit.html)), so readers with larger text get the one-pane layout in wider windows. The condition is measured against the navigator rather than the window; [Split view navigator](/v2/guide/navigation#split-view-navigator) explains why it beats setting `collapsed` from a window breakpoint.

## Size the sidebar

The other props bound the sidebar while the panes sit side by side. `sidebarWidthFraction` asks for 30% of the width, and `minSidebarWidth` and `maxSidebarWidth` keep it between 220 and 320, in sp like the condition. At the default size the sidebar gets 220; in a maximized window it stops at 320 and the note takes the rest. libadwaita's defaults (25%, between 180 and 280) leave less room for note names, which the rows cut off with an ellipsis.

The minimum and the condition go together: in the narrowest side-by-side layout, the note pane still gets about 280 beside the sidebar's 220.

## Fit a phone screen

[Create a Window](/v2/tutorial/your-first-window) set `widthRequest` and `heightRequest` to 360 by 294, the smallest size the GNOME HIG asks phone-friendly apps to support. That size now matters: a breakpoint takes away the navigator's own minimum size, so the window's size request is the only floor (see [`AdwBreakpointBin`](https://gnome.pages.gitlab.gnome.org/libadwaita/doc/1-latest/class.BreakpointBin.html#minimum-size)). At 360 the split view is collapsed, and each pane fits the width on its own.

## Run it

Narrow the window until the sidebar and the note no longer sit side by side, then open Website relaunch. The note fills the window, and the back button in its header bar returns to the list.

<figure class="result">
    <img class="result-light" src="/figures/tutorial-an-adaptive-layout-light.png" width="360" height="480" loading="lazy" alt="The Notes window at 360 pixels wide, collapsed to one pane: Website relaunch open in the editor under a header bar with a back button." />
    <img class="result-dark" src="/figures/tutorial-an-adaptive-layout-dark.png" width="360" height="480" loading="lazy" alt="The Notes window at 360 pixels wide, collapsed to one pane: Website relaunch open in the editor under a header bar with a back button." />
    <figcaption>Captured from <a href="#collapse-on-narrow-windows"><code>src/app.tsx</code></a> above, with the window at 360 by 480 after opening Website relaunch.</figcaption>
</figure>

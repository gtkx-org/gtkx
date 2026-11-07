---
description: "Change the preview renderer while the app runs and keep the open note and its state."
---

# Develop with Fast Refresh

Restyle the preview while a note stays open, and see what Fast Refresh keeps and when the app restarts instead.

::: info Being written
This chapter belongs to the Notes tutorial for GTKX 2.0 and is not written yet. The headings below are its plan; the [finished app](https://github.com/gtkx-org/gtkx/tree/main/tutorial) already contains the code.
:::

## What Fast Refresh keeps

Saving a component, or a module it imports, updates the open window and keeps state such as the open note and the editor text. See [The dev loop](/v2/guide/getting-started#the-dev-loop).

## Restyle the preview

Change how the preview renders code blocks and quotes, and watch each save apply to the open note. A code block moves into a card, and a quote gets a bar beside it.

<<< @/figures/tutorial/fast-refresh/src/preview/markdown-preview.tsx{73-103} [src/preview/markdown-preview.tsx]

## When the app restarts

Edits Fast Refresh cannot apply relaunch the app instead. See [The app restarts instead of refreshing](/v2/guide/troubleshooting#the-app-restarts-instead-of-refreshing).

## Run it

With `npm run dev` running, open Meeting notes and press the eye button in its header bar. Save each change to `markdown-preview.tsx`: the quote and the code block restyle in place, and the note stays open in the preview.

<figure class="result">
    <img class="result-light" src="/figures/tutorial-fast-refresh-light.png" width="720" height="480" loading="lazy" alt="The Notes window with Meeting notes shown as a rendered preview: a dimmed quote with a bar beside it and a code block with two npm commands in a card." />
    <img class="result-dark" src="/figures/tutorial-fast-refresh-dark.png" width="720" height="480" loading="lazy" alt="The Notes window with Meeting notes shown as a rendered preview: a dimmed quote with a bar beside it and a code block with two npm commands in a card." />
    <figcaption>Captured from <a href="#restyle-the-preview"><code>src/preview/markdown-preview.tsx</code></a> above, after opening Meeting notes and turning on the preview.</figcaption>
</figure>

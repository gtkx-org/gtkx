---
description: "Scaffold the Notes project and replace the starter counter with an Adwaita window."
---

# Create a Window

Scaffold Notes, replace the starter counter with an Adwaita window that shows an empty state, and mark its strings for translation from the start.

::: info Being written
This chapter belongs to the Notes tutorial for GTKX 2.0 and is not written yet. The headings below are its plan; the [finished app](https://github.com/gtkx-org/gtkx/tree/main/tutorial) already contains the code.
:::

## The project

What the scaffold generates: `gtkx.config.ts`, `src/index.tsx` and `src/app.tsx`, and how `npm run dev` runs them.

## Mark strings for translation

Install `@gtkx/i18n` and wrap visible strings in `t()`, so no later chapter has to retrofit them. [Translate the App](/v2/tutorial/internationalization) adds the catalogs; [Internationalization](/v2/guide/internationalization) owns the details.

## The application window

`AdwApplication`, `AdwApplicationWindow` and `AdwToolbarView` with a header bar, a status page for the empty state, and `quit()` when the window closes. See [JSX Elements](/v2/guide/jsx-elements).

<<< @/figures/tutorial/your-first-window/src/app.tsx [src/app.tsx]

## Run it

Save `src/app.tsx`. The window shows the empty state.

<figure class="result">
    <img class="result-light" src="/figures/tutorial-your-first-window-light.png" width="360" height="343" loading="lazy" alt="The Notes window: a header bar titled Notes above a status page with a new-document icon, the title No Notes, and the description Notes are Markdown files in your notes folder." />
    <img class="result-dark" src="/figures/tutorial-your-first-window-dark.png" width="360" height="343" loading="lazy" alt="The Notes window: a header bar titled Notes above a status page with a new-document icon, the title No Notes, and the description Notes are Markdown files in your notes folder." />
    <figcaption>Captured from <a href="#the-application-window"><code>src/app.tsx</code></a> above.</figcaption>
</figure>

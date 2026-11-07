---
description: "Write stories for the Markdown preview and explore its states in Storybook."
---

# Develop the Preview in Storybook

Write stories for the Markdown preview and develop its rendering one state at a time in Storybook.

::: info Being written
This chapter belongs to the Notes tutorial for GTKX 2.0 and is not written yet. The headings below are its plan; the [finished app](https://github.com/gtkx-org/gtkx/tree/main/tutorial) already contains the code.
:::

## Set up Storybook

Install the explorer, then add `"storybook": "gtkx storybook"` to the `scripts` in `package.json`. See [Storybook](/v2/guide/storybook) for the configuration options.

```sh
npm install -D @gtkx/storybook@beta
```

`.storybook/main.ts` tells the explorer where the stories are:

<<< @/figures/tutorial/storybook/.storybook/main.ts [.storybook/main.ts]

## Write stories

Stories render the preview with fixed Markdown: headings, lists, code, links and tags. The metadata sets the arguments every story shares, and each story overrides `text` or `tags`. `onActivateLink` is recorded as an action, so clicking a link in the Links story lists its URI under Actions.

<<< @/figures/tutorial/storybook/src/preview/markdown-preview.stories.tsx [src/preview/markdown-preview.stories.tsx]

## Run Storybook

`npm run storybook` opens the explorer. Its application ID is the app's with a `.Storybook` suffix, so it runs beside `npm run dev`.

## Run it

Select Formatting in the sidebar. Edit its text control: the preview renders each change. Save `markdown-preview.tsx` and the story updates in place, as the app does with Fast Refresh.

<figure class="result">
    <img class="result-light" src="/figures/tutorial-storybook-light.png" width="880" height="540" loading="lazy" alt="The GTKX Storybook window with the Preview/Markdown stories in the sidebar and Formatting selected: the preview shows bold, italic and inline code, and the Controls panel shows the story's Markdown text." />
    <img class="result-dark" src="/figures/tutorial-storybook-dark.png" width="880" height="540" loading="lazy" alt="The GTKX Storybook window with the Preview/Markdown stories in the sidebar and Formatting selected: the preview shows bold, italic and inline code, and the Controls panel shows the story's Markdown text." />
    <figcaption>Captured from <a href="#write-stories"><code>src/preview/markdown-preview.stories.tsx</code></a> above, with the Formatting story selected.</figcaption>
</figure>

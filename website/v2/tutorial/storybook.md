---
description: "Write stories for the Markdown preview and explore its states in Storybook."
---

# Develop the Preview in Storybook

Render the Markdown preview on its own, with one story for each kind of Markdown, and change how it renders without opening a note in the app.

The preview shows whatever the open note holds, so checking a nested list or a heading level in the app means first writing a note that has one. A story fixes that input instead: it renders `MarkdownPreview` with Markdown of its own. `@gtkx/storybook` shows the stories in a native explorer window; [Storybook](/v2/guide/storybook) covers it in full.

## Set up Storybook

Install the explorer as a development dependency:

```sh
npm install -D @gtkx/storybook@beta
```

Add a script that starts it to `package.json`:

```json{4} [package.json]
{
    "scripts": {
        "dev": "gtkx dev",
        "storybook": "gtkx storybook"
    }
}
```

`.storybook/main.ts` tells the explorer where the stories are, as patterns relative to the project root:

<<< @/figures/tutorial/storybook/.storybook/main.ts [.storybook/main.ts]

## Write stories

A stories file sits next to the component it renders and follows Storybook's [Component Story Format](https://storybook.js.org/docs/api/csf). Its default export, the metadata, names the component and the [arguments](https://storybook.js.org/docs/writing-stories/args) every story starts from. Each named export is a story that overrides some of them. Create `src/preview/markdown-preview.stories.tsx`:

<<< @/figures/tutorial/storybook/src/preview/markdown-preview.stories.tsx [src/preview/markdown-preview.stories.tsx]

- `title` groups the stories under Preview/Markdown in the explorer's sidebar.
- `args` gives `MarkdownPreview` empty Markdown, no tags and a link handler. Each story sets `text` to the Markdown it shows, and Tagged also sets `tags`.
- The explorer shows a [control](https://storybook.js.org/docs/essentials/controls) only for an argument whose `argTypes` entry declares one. Formatting declares a text control for `text`. A text control is a one-line entry, so the other stories, whose Markdown spans several lines, have none.
- `action: "activate-link"` lists each call to `onActivateLink` under Actions, with the link's target, and still calls the handler from `args`. That handler returns `true`, which tells the label the link is handled (see [Follow links](/v2/tutorial/the-markdown-preview#follow-links)), so GTK doesn't try to open it.

The stories import `MarkdownPreview` rather than define it, because Fast Refresh updates a component only when it lives in its own module. [Test the App](/v2/tutorial/testing) renders the same stories in its tests.

## Run Storybook

```sh
npm run storybook
```

The explorer lists the stories in its sidebar. Selecting one shows the preview beside the story's Controls and Actions. Its application ID is the app's with a `.Storybook` suffix, `dev.gtkx.Notes.Storybook`. Under the app's own ID, a second launch would only activate the running app (see [The application element](/v2/guide/application-lifecycle#the-application-element)), so the explorer runs beside `npm run dev`.

## Run it

Select Formatting and edit its text control: the preview renders each change as you type. Select Links and click a link: Actions lists `activate-link` with the link's target.

Keep the explorer open, change `src/preview/markdown-preview.tsx` and save it: the story updates in place, as the app does with [Fast Refresh](/v2/tutorial/fast-refresh).

<figure class="result">
    <img class="result-light" src="/figures/tutorial-storybook-light.png" width="880" height="540" loading="lazy" alt="The GTKX Storybook window with the Preview/Markdown stories in the sidebar and Formatting selected: the preview shows bold, italic and inline code, and the Controls panel shows the story's Markdown text." />
    <img class="result-dark" src="/figures/tutorial-storybook-dark.png" width="880" height="540" loading="lazy" alt="The GTKX Storybook window with the Preview/Markdown stories in the sidebar and Formatting selected: the preview shows bold, italic and inline code, and the Controls panel shows the story's Markdown text." />
    <figcaption>Captured from <a href="#write-stories"><code>src/preview/markdown-preview.stories.tsx</code></a> above, with the Formatting story selected.</figcaption>
</figure>

# Native Storybook example

Run from the repository root:

```sh
pnpm nx dev storybook-example
```

For a private headless display:

```sh
pnpm --filter storybook-example dev --headless --size 1280x900
```

Select a counter story, change its label, step, enabled state, or unit in Controls, then click the preview button and inspect Actions. Reset restores the story defaults and component state. The invalid-step story demonstrates recovery by selecting another story.

The confirmation story opens an Adwaita dialog and records an explicit action. The progress story owns a separate Adwaita window that closes when the story is unmounted. Shared decorators and initial globals live in `.storybook/preview.tsx`.

The same stories run as native integration fixtures:

```sh
pnpm nx test storybook-example
```

See the [Storybook guide](../../docs/storybook.md) for configuration, lifecycle, testing, and compatibility details.

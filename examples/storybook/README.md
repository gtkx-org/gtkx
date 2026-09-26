# Native Storybook example

Complete the [workspace setup](../../website/contributing/development.md), then run from the repository root:

```sh
pnpm nx dev storybook-example
```

For a private headless display:

```sh
pnpm --filter storybook-example dev --headless --size 1280x900
```

Select a counter story, edit Controls, then click the preview button and inspect Actions. Reset restores its defaults and component state. Select another story to recover from the invalid-step example.

The confirmation story opens a dialog; the progress story owns a window that closes when you leave it. Shared decorators and initial globals live in `.storybook/preview.tsx`.

The same stories run as native integration fixtures:

```sh
pnpm nx test storybook-example
```

See the [Storybook guide](https://gtkx.dev/v2/guide/storybook) for configuration, lifecycle, testing, and compatibility details.

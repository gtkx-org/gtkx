# Native Storybook example

Component stories for counters, dialogs, and windows, with editable props and integration tests.

Complete the [workspace setup](../../CONTRIBUTING.md#set-up-the-workspace), then run from the repository root:

```sh
pnpm nx dev storybook-example
```

For a private headless display:

```sh
pnpm --filter storybook-example dev --headless --size 1280x900
```

Select a counter story and change its props in Controls. Click the counter button in the preview to see its events in Actions. Reset restores the default props and component state. Select another story to leave the invalid-step example.

The confirmation story opens a dialog; the progress story owns a window that closes when you leave it. Shared decorators and initial globals live in `.storybook/preview.tsx`.

The same stories run as native integration fixtures. The tests demonstrate shared decorators and argument overrides, dialog interaction, and window cleanup:

```sh
pnpm nx test storybook-example
```

See the [Storybook guide](https://gtkx.dev/v2/guide/storybook) for configuration, lifecycle, testing, and compatibility details.

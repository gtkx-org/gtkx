# Tasks

Tasks is the complete Linux application built by the [GTKX tutorial](https://gtkx.dev/v2/tutorial/). Its Adwaita foundation combines adaptive navigation, forms, settings, actions, dialogs, notifications, localization, persistence, testing, and Linux packaging.

![Tasks in an adaptive Adwaita window](assets/screenshot.png)

This app is excluded from the pnpm workspace and installs the published GTKX beta packages declared in [package.json](package.json). Install the [native prerequisites](https://gtkx.dev/v2/guide/getting-started), then run from this directory:

```bash
npm install
npm run dev
```

Run `npm run typecheck` to check application types. Install the [headless test dependencies](https://gtkx.dev/v2/guide/testing#setup), then run `npm test` to check application behavior, timezone handling, and compiled translations.

Follow the [tutorial](https://gtkx.dev/v2/tutorial/) to build the app step by step, or go directly to [desktop integration](https://gtkx.dev/v2/tutorial/actions-menus-shortcuts) and [packaging](https://gtkx.dev/v2/tutorial/packaging).

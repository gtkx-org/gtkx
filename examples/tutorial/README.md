# tutorial

Tasks is the complete application built by the [GTKX tutorial](https://gtkx.dev/tutorial/). It combines adaptive navigation, forms, settings, actions, dialogs, notifications, localization, persistence, testing, and Linux packaging.

![Tasks in an adaptive Adwaita window](assets/screenshot.png)

This example is excluded from the pnpm workspace and consumes published packages like an external project:

```bash
npm install
npm run dev
```

From the repository root, `pnpm tutorial` publishes the working packages to a local registry and validates the example against them. See [desktop integration](https://gtkx.dev/tutorial/actions-menus-shortcuts) and [packaging](https://gtkx.dev/tutorial/packaging).

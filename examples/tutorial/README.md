# Tasks

Tasks is the complete Linux application built by the [GTKX tutorial](https://gtkx.dev/v2/tutorial/). Its Adwaita foundation combines adaptive navigation, forms, settings, actions, dialogs, notifications, localization, persistence, testing, and Linux packaging.

![Tasks in an adaptive Adwaita window](assets/screenshot.png)

This example is excluded from the pnpm workspace and consumes published packages like an external project:

```bash
npm install
npm run dev
```

From the repository root, `pnpm tutorial` publishes the working packages to a local registry and validates the example against them. See [desktop integration](https://gtkx.dev/v2/tutorial/actions-menus-shortcuts) and [packaging](https://gtkx.dev/v2/tutorial/packaging).

The [chapter checkpoints](checkpoints/README.md) reconstruct all 18 chapters for v2 and stable 1.6 directly from the documentation. They validate each intermediate app and run the tests introduced by that point. The current v2 tutorial needs repository builds beyond chapter 9; the checkpoint guide explains that setup. `pnpm tutorial` checks this finished example independently.

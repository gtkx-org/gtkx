# navigation

A small mail-style app built on [`@gtkx/navigation`](../../packages/navigation), React Navigation for GTKX. A drawer lists three sections, Inbox is a stack of pages, Settings is a pair of tabs, and every navigator is rendered with a libadwaita widget: `AdwOverlaySplitView`, `AdwNavigationView`, and `AdwViewStack` with an `AdwViewSwitcher`.

## What it demonstrates

- `NavigationContainer` around a `createDrawerNavigator` whose sidebar rows, icons, and header come from screen options such as `drawerIcon` and `headerShown`.
- A nested `createStackNavigator` with typed param lists: activating an inbox row navigates to `Message` with `{ id }`, and the message's Reply button pushes a `Compose` page.
- `usePreventRemove` on the compose page: pressing Back, Escape, or Alt+Left with a non-empty draft shows an `AdwAlertDialog`, and its Discard response dispatches the prevented action.
- A nested `createTabNavigator` whose tabs are mounted lazily and switched from the header bar's view switcher.
- `useTheme()` reporting Adwaita's live color scheme, with a switch that flips `Adw.StyleManager` between light and dark.
- `DrawerActions.toggleDrawer()` from a header bar button, and `navigation.getParent()` to reach the drawer from inside the tabs.
- `StackScreenProps`, `TabScreenProps`, and `DrawerScreenProps` typing every screen's `navigation` and `route`.

## Run it

Install and build the workspace once from the repository root, then:

```sh
pnpm --filter navigation dev
```

`gtkx dev` starts the dev server with Fast Refresh. `pnpm --filter navigation build` writes `dist/bundle.mjs`, which `pnpm --filter navigation start` runs with Node.js.

## Test it

```sh
pnpm --filter navigation test
```

The tests drive the app the way a user would, with `@gtkx/testing`: they activate inbox rows, type a reply, press the header bar's back button, answer the discard dialog, pick sections from the sidebar, and click tabs and switches, asserting what is on screen after each step.

## Learn more

- [Navigation guide](https://gtkx.dev/guide/navigation)
- [React Navigation documentation](https://reactnavigation.org/docs/getting-started)

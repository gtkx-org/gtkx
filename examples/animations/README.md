# animations

A tour of [`@gtkx/animated`](../../packages/animated), the React Spring target for GTKX. A sidebar lists one page per animation primitive; every page is interactive, so you can trigger and replay each animation while watching real GTK widgets move.

## What it demonstrates

- `useSpring` with the built-in `config` presets (`gentle`, `wobbly`, `stiff`, `slow`, `molasses`), animating widget properties such as opacity and margins through `animated.GtkLabel`-style wrappers.
- Interpolation with `value.to(...)`: one spring driving formatted label text, a progress fraction, and widget geometry at once.
- `useSprings` for a set of independently animated widgets.
- `useTrail` for staggered entrances.
- `useTransition` for animating items as they mount and unmount.
- `useChain` with `useSpringRef` for sequencing animations, forward and reversed.
- `useSpringValue` and the imperative API: `start`, `pause`, `resume`, `set`.
- Animating `Gsk.Transform` values on `GtkFixedLayoutChild` to move a widget inside a `GtkFixed`.
- `useReducedMotion`, which honors the desktop's reduce-animations setting.

Animated values are written to widgets on each GTK frame-clock tick, without re-rendering React components.

## Run it

Install and build the workspace once from the repository root, then:

```sh
pnpm --filter animations dev
```

`gtkx dev` starts the dev server with Fast Refresh. `pnpm --filter animations build` writes `dist/bundle.mjs`, which `pnpm --filter animations start` runs with Node.js.

## Test it

```sh
pnpm --filter animations test
```

The tests drive each demo the way a user would, with `@gtkx/testing`: they click the demo's buttons and wait for the animated widget properties to settle at their targets on a real frame clock.

## Learn more

- [`@gtkx/animated` package](../../packages/animated)
- [React Spring documentation](https://react-spring.dev)

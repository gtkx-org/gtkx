---
title: "Animations"
description: "Animate native widget properties and GTK styles with React Spring."
---

# Animations

`@gtkx/animated` adapts [React Spring](https://www.react-spring.dev) to GTKX. Learn how to create and control springs in the React Spring docs; this guide covers how those values reach native GTKX elements. Install the package separately:

```bash
npm install @gtkx/animated@beta
```

## Animated components

`animated(Component)` wraps a GTKX element so its mutable props accept values from React Spring. Create the wrapper at module scope, then pass it the values a hook returns:

```tsx
import { animated, useSpring } from "@gtkx/animated";
import { GtkLabel } from "@gtkx/jsx/gtk";

const AnimatedLabel = animated(GtkLabel);

export const FadeIn = () => {
    const styles = useSpring({ from: { opacity: 0 }, to: { opacity: 1 } });

    return <AnimatedLabel opacity={styles.opacity} label="Hello" />;
};
```

Wrap generated elements, non-widget objects such as `GtkAdjustment`, or your own components. There is no `animated.div`-style element map as in `@react-spring/web`; pass `animated` the element you import.

For writable GObject props, each frame updates the native object through its `ref` without rerendering the component. This includes `opacity`, margins, size requests, and adjustment values. Construct-only props remain static, and TypeScript rejects springs passed to them. A label's text children also accept animated values, alone or next to static text:

```tsx
const { count } = useSpring({ from: { count: 0 }, to: { count: 100 } });

<AnimatedLabel>
    {count.to((value) => value.toFixed(0))}
    {" items"}
</AnimatedLabel>;
```

GTKX truncates whole-number properties, such as margins, toward zero and clamps values to the native property range. An opacity spring cannot exceed 1, and margins cannot be negative. To slide a widget using a margin, animate from a positive margin to zero.

A custom component that forwards its `ref` to the native object receives the same updates. Otherwise, the wrapper rerenders the component with the current values.

Props that are not GObject properties, such as `accessible*`, animate by re-rendering the component on each frame.

## Animated styles

The [`style` prop](/v2/guide/css#style-one-widget) accepts springs too. GTKX writes animated declarations into its shared `Gtk.CssProvider` without re-rendering the component, and reloads the provider once for all the updates of one frame. A spring can drive the whole object or one declaration:

```tsx
import { animated, useSpring } from "@gtkx/animated";
import { GtkLabel } from "@gtkx/jsx/gtk";

const AnimatedLabel = animated(GtkLabel);

export const Deadline = ({ isOverdue }: { isOverdue: boolean }) => {
    const { level } = useSpring({ level: isOverdue ? 1 : 0 });

    return (
        <AnimatedLabel
            label="Due today"
            style={level.to((value) => ({ color: `mix(var(--window-fg-color), var(--error-color), ${value})` }))}
        />
    );
};
```

The spring carries a number and the interpolation builds the declaration around it. A spring returned by `useSpring` can also be passed directly as the style object or placed on one declaration:

```tsx
const styles = useSpring({ from: { color: "red" }, to: { color: "blue" } });

<AnimatedLabel style={styles} label="Due today" />;
<AnimatedLabel style={{ color: styles.color, paddingTop: 4 }} label="Due today" />;
```

Nested blocks work too, so <span v-pre>`style={{ "&:hover": { color: styles.color } }}`</span> is animated without a React render. Only `style` is read this way; a spring nested inside another object-valued prop is not tracked.

A provider reload invalidates styling across the display. Prefer a native property for effects it can express, or a CSS `transition` or `@keyframes` for a fixed state change. Use animated `style` for dynamic CSS values, and profile large trees with many animations. For custom drawing, call `queueDraw()` on a [`GtkDrawingArea`](/v2/guide/cairo#draw-in-a-widget) as values change.

## Moving widgets

To animate position, use a container that exposes it. Inside a `GtkFixed`, the `transform` of a `GtkFixedLayoutChild` is a `Gsk.Transform`, and an interpolation builds one from the spring:

```tsx
import { animated, useSpring } from "@gtkx/animated";
import * as Graphene from "@gtkx/gi/graphene";
import * as Gsk from "@gtkx/gi/gsk";
import { GtkButton, GtkFixed, GtkFixedLayoutChild } from "@gtkx/jsx/gtk";

const AnimatedFixedLayoutChild = animated(GtkFixedLayoutChild);

const translate = (x: number): Gsk.Transform | null => Gsk.Transform.new().translate(new Graphene.Point({ x, y: 0 }));

export const Slide = ({ isOpen }: { isOpen: boolean }) => {
    const { x } = useSpring({ x: isOpen ? 240 : 0 });

    return (
        <GtkFixed>
            <AnimatedFixedLayoutChild transform={x.to(translate)}>
                <GtkButton label="Slide" />
            </AnimatedFixedLayoutChild>
        </GtkFixed>
    );
};
```

Elsewhere, animate the margins, the size requests, a `Gtk.Paned`'s `position`, or a CSS `transform` through `style`, which changes the painted position without changing layout.

## React Spring APIs

`@gtkx/animated` re-exports React Spring's platform-neutral APIs, so import hooks such as `useSpring` and `useTransition` from it rather than from `@react-spring/web`. DOM hooks such as [`useScroll`](https://www.react-spring.dev/docs/utilities/use-scroll) and [`useInView`](https://www.react-spring.dev/docs/utilities/use-in-view) have no GTK counterpart and are not exported.

## The frame clock

Frames advance during the update phase of a mapped window's GTK frame clock, before layout and painting. GTKX keeps using that window while it can supply frames, switching to another mapped window or a timer when necessary.

## Reduced motion

GTK exposes two settings with different effects:

- `gtk-enable-animations` disables motion across the toolkit. When false, GTKX springs jump to their targets while still running their lifecycle callbacks, and a `loop` stops after its current pass. GTKX applies each change of this setting to React Spring's [`Globals.skipAnimation`](https://www.react-spring.dev/docs/advanced/globals), so an in-app preference can set `skipAnimation` itself; the next change of the setting overrides it.
- `gtk-interface-reduced-motion`, available in GTK 4.22 and later, asks applications to reduce motion. It also drives GTK's `prefers-reduced-motion` media query. Springs keep running; the component chooses an alternative, such as a fade instead of a slide.

`useReducedMotion()` returns `true` when either preference calls for less motion, `false` otherwise, and `null` before a display is open. It updates when the settings change.

`@gtkx/testing` disables animations by default, so springs reach their targets on the first frame. Assert the result with `findBy*` or `waitFor`. Pass `areAnimationsEnabled: true` to `render` when the test needs to exercise motion.

## Next

Continue with [Native Values](/v2/guide/native-values) to pass GTypes, GValues and integers to native methods.

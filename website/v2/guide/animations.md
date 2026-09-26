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

Wrap generated elements, non-widget objects such as `GtkAdjustment`, or your own components. A module-scoped wrapper keeps its component identity between renders, and production builds retain only the elements the app uses.

Each frame, the current values are written straight onto the widget through its `ref`, so the component does not re-render while the spring runs. Writable GObject props such as `opacity`, margins, size requests, and adjustment values can be animated this way. Construct-only props remain static, and TypeScript rejects springs passed to them. Labels and text children also accept animated values:

```tsx
const { count } = useSpring({ from: { count: 0 }, to: { count: 100 } });

<AnimatedLabel label={count.to((value) => `${Math.round(value)}%`)} />;
```

GTKX truncates whole-number properties, such as margins, toward zero and clamps values to the native property range. An opacity spring cannot exceed 1, and margins cannot be negative. To slide a widget using a margin, animate from a positive margin to zero.

The wrapper passes a `ref` through. A component of your own that forwards it to the widget it renders gets the same per-frame writes, while one that keeps the `ref` re-renders with the current values instead.

Props that are not GObject properties, such as `accessible*`, animate by re-rendering the component on each frame. `style` is handled specially: animated declarations update the shared stylesheet imperatively, without re-rendering the component.

## Animated styles

GTK4 has no inline styles, so the [`style` prop](/v2/guide/css) serializes its object into a rule in GTKX's shared `Gtk.CssProvider`. A spring can drive the whole object or one declaration, and updates made during the same animation turn are applied with one provider reload:

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

A provider reload invalidates styling across the display. Prefer a native property for effects it can express, or a CSS `transition` or `@keyframes` for a fixed state change. Use animated `style` for dynamic CSS values, and profile large trees with many animations. For custom drawing, use `GtkDrawingArea` and call `queueDraw()` as values change.

## Moving widgets

GTK positions widgets through layout, so a position is animated where a container lets you set one. Inside a `GtkFixed`, the `transform` of a `GtkFixedLayoutChild` is a `Gsk.Transform`, and an interpolation builds one from the spring:

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

Elsewhere, animate the margins, the size requests, a `Gtk.Paned`'s `position`, or a CSS `transform` through `style`, which moves what the widget paints without disturbing the layout around it.

## React Spring APIs

`@gtkx/animated` re-exports React Spring's platform-neutral APIs. Use the [React Spring documentation](https://www.react-spring.dev) to choose and configure hooks, transitions, and controllers, then pass their animated values to GTKX props as shown above. Browser hooks that depend on the DOM have no GTK counterpart and are not exported.

## The frame clock

Frames advance during the update phase of a mapped window's GTK frame clock, before layout and painting. GTKX keeps using that window while it can supply frames, switching to another mapped window or a timer when necessary.

## Reduced motion

GTK exposes two settings with different effects:

- `gtk-enable-animations` disables motion across the toolkit. When false, GTKX springs jump to their targets while still running their lifecycle callbacks.
- `gtk-interface-reduced-motion`, available in GTK 4.22 and later, asks applications to reduce motion. It also drives GTK's `prefers-reduced-motion` media query. Springs keep running; the component chooses an alternative, such as a fade instead of a slide.

`useReducedMotion()` returns `true` when either preference calls for less motion, `false` otherwise, and `null` before a display is open. It updates when the settings change.

`@gtkx/testing` disables animations by default, so springs reach their targets on the first frame. Assert the result with `findBy*` or `waitFor`. Pass `areAnimationsEnabled: true` to `render` when the test needs to exercise motion.

## Next

Continue with [Cairo](/v2/guide/cairo) to draw 2D graphics inside a widget.

---
title: "Animations"
description: "Animate native widget properties and GTK styles with React Spring."
---

# Animations

`@gtkx/animated` adapts [React Spring](https://www.react-spring.dev) to GTKX. Learn how to create and control springs in the React Spring docs; this guide covers how those values reach native GTKX elements. Install the package separately:

```bash
npm install @gtkx/animated@1.6.0
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

This works for every element in `@gtkx/jsx` and for components of your own. Keeping the wrapper at module scope also gives React a stable component type, so it does not remount between renders.

Property access such as `animated.GtkLabel` remains available in GTKX 1.6 for compatibility, but is deprecated and removed in 2.0. Import the component and use the call form above. It works for elements that are not widgets, such as `GtkAdjustment`, and components of your own, while letting a production bundle retain only the components it reaches.

Each frame, the current values are written straight onto the widget through its `ref`, so the component does not re-render while the spring runs. Writable GObject props such as `opacity`, margins, size requests, and adjustment values can be animated this way. The `style` prop, labels, and text children also accept animated values:

```tsx
const { count } = useSpring({ from: { count: 0 }, to: { count: 100 } });

<AnimatedLabel label={count.to((value) => `${Math.round(value)}%`)} />;
```

GTKX truncates whole-number properties, such as margins, toward zero and clamps values to the native property range. An opacity spring cannot exceed 1, and margins cannot be negative. To slide a widget using a margin, animate from a positive margin to zero.

The wrapper passes a `ref` through. A component of your own that forwards it to the widget it renders gets the same per-frame writes, while one that keeps the `ref` re-renders with the current values instead.

Props that are not GObject properties, such as the `accessible*` props, still animate: the component re-renders with the current value on each frame. `style` is the exception, and it gets its own section next.

## Animated styles

In GTKX 1.6, the [`style` prop](/guide/css) compiles to a rule in a widget-specific `Gtk.CssProvider`. The spring reloads that rule each frame without a React render. Use it for effects exposed through CSS, such as color:

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

The interpolation turns a number into a CSS declaration. GTK's `mix()` blends two colors; `alpha()` scales a color's opacity.

A spring can also sit on a single declaration rather than on the whole prop, which is how React Spring is written for the DOM:

```tsx
const styles = useSpring({ from: { color: "red" }, to: { color: "blue" } });

<AnimatedLabel style={styles} label="Due today" />;
<AnimatedLabel style={{ color: styles.color, paddingTop: 4 }} label="Due today" />;
```

Nested blocks also accept springs, such as <span v-pre>`style={{ "&:hover": { color: styles.color } }}`</span>. Only `style` tracks nested springs; other object-valued props do not.

This also supports effects such as `border-radius`, `box-shadow`, and `filter`.

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

Continue with [Cairo](/guide/cairo) to draw 2D graphics inside a widget.

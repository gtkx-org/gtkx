---
title: "Animations"
description: "Animate native widgets with @gtkx/animated, the React Spring target for GTKX: animated(Component), springs, interpolations, animated styles, transitions, the GTK frame clock, and reduced motion."
---

# Animations

`@gtkx/animated` brings [React Spring](https://www.react-spring.dev) to GTKX. It is React Spring's engine with a GTK target: the hooks and components are the ones the React Spring docs describe, and the `animated` components are GTKX widgets whose props accept springs. It installs separately:

```bash
npm install @gtkx/animated
```

## Animated components

`animated(Component)` returns the same component with props that also take a `SpringValue` or an `Interpolation`. Wrap an element once, at module scope, and hand the result the values a hook returns:

```tsx
import { animated, useSpring } from "@gtkx/animated";
import { GtkLabel } from "@gtkx/jsx/gtk";

const AnimatedLabel = animated(GtkLabel);

export const FadeIn = () => {
    const styles = useSpring({ from: { opacity: 0 }, to: { opacity: 1 } });

    return <AnimatedLabel opacity={styles.opacity} label="Hello" />;
};
```

This works for every element in `@gtkx/jsx`, whichever library it comes from, and for components of your own. The wrapper of a given component is created once and reused, so wrapping the same component again returns the same wrapper. Wrap at module scope all the same: the React Hooks lint rule flags a component created during render, and a component *defined* during render gets a fresh wrapper each time, which remounts it on every render.

Property access such as `animated.GtkLabel` remains available in GTKX 1.6 for compatibility, but is deprecated and removed in 2.0. Import the component and use the call form above. It works for elements that are not widgets, such as `GtkAdjustment`, and components of your own, while letting a production bundle retain only the components it reaches.

Each frame, the current values are written straight onto the widget through its `ref`, so the component does not re-render while the spring runs. Every GObject property a widget exposes as a prop can be animated this way: `opacity`, the margins, `widthRequest` and `heightRequest`, `spacing`, a `Gtk.Adjustment`'s `value`, a progress bar's `fraction`, and so on. So can the `style` prop, which is not a GObject property at all. A `label` or a text child can be an interpolation too:

```tsx
const { count } = useSpring({ from: { count: 0 }, to: { count: 100 } });

<AnimatedLabel label={count.to((value) => `${Math.round(value)}%`)} />;
```

A value the property cannot hold as written is fitted to it: a spring headed for a whole-number property such as a margin is truncated toward zero, and a value outside the range a property allows, such as an `opacity` that a bouncy spring overshoots past 1 or a margin that dips below 0, is clamped to it. GTK margins cannot go negative, so slide a widget in by shrinking a margin rather than by growing one from a negative start.

The wrapper passes a `ref` through. A component of your own that forwards it to the widget it renders gets the same per-frame writes, while one that keeps the `ref` re-renders with the current values instead.

Props that are not GObject properties, such as the `accessible*` props, still animate: the component re-renders with the current value on each frame. `style` is the exception, and it gets its own section next.

## Animated styles

GTK4 has no inline styles, so the [`style` prop](/guide/css) compiles to a rule in a `Gtk.CssProvider` that belongs to the widget alone. That provider is what a spring writes each frame: it reloads one rule for one widget, and the component does not re-render, exactly as for a GObject property. It is how you animate what GTK4 exposes through CSS and through nothing else, a color above all:

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

The spring carries a number and the interpolation builds the declaration around it. GTK4's `mix()` blends two colors by a fraction and `alpha()` scales one's opacity, so a color animation is a number animation; any other property is built the same way, out of a template string.

A spring can also sit on a single declaration rather than on the whole prop, which is how React Spring is written for the DOM:

```tsx
const styles = useSpring({ from: { color: "red" }, to: { color: "blue" } });

<AnimatedLabel style={styles} label="Due today" />;
<AnimatedLabel style={{ color: styles.color, paddingTop: 4 }} label="Due today" />;
```

Both forms work, nested blocks included, so <span v-pre>`style={{ "&:hover": { color: spring } }}`</span> animates on hover. Hand the object a spring hook returns straight to `style`, put springs on the declarations you want to move, or interpolate the whole object out with `spring.to(…)` — whichever reads better for the animation at hand. Only the `style` prop is read this way; a spring nested inside any other object-valued prop, such as a `Pango.AttrList`, is not tracked.

Because the rule is scoped to that one widget, this also animates what a widget has no property for at all: a `border-radius` that opens up, a `box-shadow` that lifts, a `filter` that desaturates a row as it is dismissed.

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

## Transitions and the rest of React Spring

`useTransition` mounts and unmounts widgets with enter and leave animations, `useTrail` staggers a list, `useSprings` drives several springs at once, `useChain` sequences them, and `useSpringRef` hands you imperative control. The `Spring`, `Trail`, and `Transition` components are the render-prop forms. `config`, `easings`, `to`, `SpringValue`, `Controller`, and the types are all exported from `@gtkx/animated`:

```tsx
import { animated, useTransition } from "@gtkx/animated";
import * as Gtk from "@gtkx/gi/gtk";
import { GtkBox, GtkLabel } from "@gtkx/jsx/gtk";

const AnimatedLabel = animated(GtkLabel);

export const Toasts = ({ messages }: { messages: string[] }) => {
    const transitions = useTransition(messages, {
        from: { opacity: 0, marginTop: 16 },
        enter: { opacity: 1, marginTop: 0 },
        leave: { opacity: 0, marginTop: 16 },
    });

    return (
        <GtkBox orientation={Gtk.Orientation.VERTICAL}>
            {transitions((styles, message) => (
                <AnimatedLabel opacity={styles.opacity} marginTop={styles.marginTop} label={message} />
            ))}
        </GtkBox>
    );
};
```

The hooks that read the DOM, `useScroll`, `useResize`, and `useInView`, have no GTK counterpart and are not exported.

## The frame clock

Frames come from GTK's frame clock: animations advance in the update phase of the newest mapped window's clock, so writes land before that window lays out and paints, in step with the display. When the driving window goes away, another mapped window takes over; when no window is mapped, or the clock stops ticking, a timer paces the frames instead, so a spring always reaches its target and its `onRest` always fires.

## Reduced motion

GTK's `gtk-enable-animations` setting is the toolkit-wide switch, and the package follows it the way GTK's own transitions do: while animations are disabled, every spring jumps to its target and the rest of the lifecycle runs as usual. The desktop's reduced-motion preference is a separate setting, `gtk-interface-reduced-motion` on GTK 4.22 and later, the one behind the `prefers-reduced-motion` media query; it asks for less motion rather than none, so springs keep running and components decide what to reduce. `useReducedMotion()` reports `true` in either case, `false` otherwise, and `null` before a display is open, and re-renders when the settings change, so a component can trade a slide for a fade.

The `render` helper in `@gtkx/testing` disables animations unless it is given `areAnimationsEnabled: true`, so a spring lands on its final value on the first frame; assert with `findBy*` or `waitFor`, which resolve right away instead of after the animation's duration, and opt in when a test wants to watch the motion.

## Next

Continue with [Cairo](/guide/cairo) to draw 2D graphics inside a widget.

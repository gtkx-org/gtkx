---
title: "Animations"
description: "Animate Adwaita and GTK4 widgets in a GNOME app with GTKX's React Spring target."
---

# Animations

`@gtkx/animated` brings [React Spring](https://www.react-spring.dev) to GTKX's native GNOME applications. It uses React Spring's engine with a GTK target, which lets the same primitives animate both libadwaita application surfaces and their underlying GTK4 widgets. The hooks and components are the ones the React Spring docs describe, and the `animated` components are GTKX widgets whose props accept springs. It installs separately:

```bash
npm install @gtkx/animated@beta
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

This works for every generated JSX element, whichever library it comes from, and for components of your own. The wrapper of a given component is created once and reused, so wrapping the same component again returns the same wrapper. Wrap at module scope all the same: the React Hooks lint rule flags a component created during render, and a component *defined* during render gets a fresh wrapper each time, which remounts it on every render.

The call form also works for elements that are not widgets, such as `GtkAdjustment`, and components of your own, while letting a production bundle retain only the components it reaches.

Each frame, the current values are written straight onto the widget through its `ref`, so the component does not re-render while the spring runs. Every GObject property a widget exposes as a prop can be animated this way: `opacity`, the margins, `widthRequest` and `heightRequest`, `spacing`, a `Gtk.Adjustment`'s `value`, a progress bar's `fraction`, and so on. A `label` or a text child can be an interpolation too:

```tsx
const { count } = useSpring({ from: { count: 0 }, to: { count: 100 } });

<AnimatedLabel label={count.to((value) => `${Math.round(value)}%`)} />;
```

A value the property cannot hold as written is fitted to it: a spring headed for a whole-number property such as a margin is truncated toward zero, and a value outside the range a property allows, such as an `opacity` that a bouncy spring overshoots past 1 or a margin that dips below 0, is clamped to it. GTK margins cannot go negative, so slide a widget in by shrinking a margin rather than by growing one from a negative start.

The wrapper passes a `ref` through. A component of your own that forwards it to the widget it renders gets the same per-frame writes, while one that keeps the `ref` re-renders with the current values instead.

Props that are not GObject properties, such as the `accessible*` props, still animate by re-rendering the component with the current value on each frame. Reserve that path for values that genuinely need it. `style` is handled specially: animated declarations update the shared stylesheet imperatively, without re-rendering the component.

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

Animated styles are supported, but a provider reload still makes GTK invalidate styling across the display. Animate a native GObject property when one represents the effect, and prefer a class with a CSS `transition` or `@keyframes` for a fixed CSS state change. Use animated `style` when the value is composed dynamically or the effect exists only in CSS, and profile it when many widgets move at once in a large tree. For continuously changing custom pixels, draw them in a `GtkDrawingArea` and call `queueDraw()` as the value changes.

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

Continue with [Cairo](/v2/guide/cairo) to draw 2D graphics inside a widget.

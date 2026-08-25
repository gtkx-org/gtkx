---
title: "GTKX 1.3: Introducing @gtkx/animated"
description: "GTKX 1.3 adds @gtkx/animated, React Spring's engine with a GTK target, and a per-widget style prop. Springs are written straight onto widget properties on every frame of the GTK frame clock, without a React render, and reach color, background and border radius through a rule scoped to the widget alone."
image: /animations-demo.png
---

# GTKX 1.3

<p class="post-date">August 21, 2026</p>

GTKX 1.3 is out. The headline is [`@gtkx/animated`](/guide/animations), React Spring's engine with a GTK target, alongside a per-widget [`style`](/guide/css) prop that springs can drive, a new [`@gtkx/cairo`](/guide/cairo) package and a much larger [`registerClass`](/guide/subclassing). Read the [`changelog`](https://github.com/gtkx-org/gtkx/releases/tag/v1.3.0) for the full list of changes.

<video src="/animations-demo.webm" poster="/animations-demo.webp" width="1120" height="480" autoplay loop muted playsinline controls preload="metadata" aria-label="Screen recording of the GTKX animations example. Each page in the sidebar drives a different React Spring primitive against real GTK widgets: a card fades and slides between two targets, one spring fills a progress bar while counting up a label, a column of level bars and a staggered trail of labels animate together, list items fade in and out as they mount and unmount, a panel and its items sequence in turn, a level bar is started and paused by hand, a label slides and tilts between the corners of a fixed layout, and a notification card animates its background, corner radius and shadow through the style prop while its text color crosses to white."></video>

*The [`animations`](https://github.com/gtkx-org/gtkx/tree/main/examples/animations) example, one page per primitive, driving real GTK widgets.*

Until now, animating anything in GTKX meant reaching for GTK's own machinery: an `Adw.TimedAnimation`, a `Gtk.Revealer`, a tick callback and some arithmetic. All of it works, and none of it composes with React. A revealer animates the one thing a revealer animates. A tick callback that moves a margin has to be started, stopped, and torn down by hand, and it has no idea that the component owning it has just re-rendered with a different target.

React already has an answer to that, and it is React Spring. 1.3 does not reimplement it; it gives it somewhere to write:

```bash
npm install @gtkx/animated
```

## Springs are written onto widgets, not into a shared style sheet

`animated(Component)` returns the same component with props that also accept a `SpringValue` or an `Interpolation`:

```tsx
import { animated, useSpring } from "@gtkx/animated";
import { GtkLabel } from "@gtkx/jsx/gtk";

const AnimatedLabel = animated(GtkLabel);

export const FadeIn = () => {
    const styles = useSpring({ from: { opacity: 0 }, to: { opacity: 1 } });

    return <AnimatedLabel opacity={styles.opacity} label="Hello" />;
};
```

Every widget also hangs off `animated` directly, so `animated.GtkLabel` is `animated(GtkLabel)` without the import. The two are the same component, memoized per wrapped component, so they can be mixed freely.

What happens on each frame is the part that is not React Spring's. The wrapper keeps the widget's `ref`, and every frame it writes the current values straight onto the widget through that `ref`. The component does not re-render while a spring runs, which is what keeps a `useTrail` over a column of labels down to a handful of property writes per frame instead of a reconciliation pass. Any GObject property a widget exposes as a prop can be driven this way: `opacity`, the margins, `widthRequest` and `heightRequest`, `spacing`, a `Gtk.Adjustment`'s `value`, a progress bar's `fraction`. A `label` or a text child takes an interpolation too, so a counter is one spring and a format function.

Writes are silent as far as your handlers are concerned. Animating a `GtkSpinButton`'s `value` moves the widget without calling its `onValueChanged`, because the write is not a user event and the reconciler knows the difference.

## Numbers are fitted to the property they land on

CSS accepts a fractional pixel and an opacity of 1.03 without comment. GObject does not: a `gint` property rejects `12.7`, and a property with a range rejects anything outside it. A spring produces exactly those values, constantly — that is what a spring is.

So every animated write is fitted to its target. A value headed for a whole-number property is truncated toward zero, and a value outside the range a property allows is clamped to it. A `config.wobbly` spring that overshoots `opacity` past 1 lands on 1; a margin that dips below 0 lands on 0. Non-numbers pass through untouched, which is why a `Gsk.Transform` works.

The one thing to know is that GTK margins cannot go negative, so a widget slides in by shrinking a margin rather than by growing one from a negative start.

## Moving a widget

There is no transform shorthand, on purpose. GTK positions widgets through layout, not through a string a parser has to take apart, so a position is animated where a container lets you set one. Inside a `GtkFixed`, that is the `transform` of a `GtkFixedLayoutChild`, and an interpolation builds one:

```tsx
import { animated, to, useSpring } from "@gtkx/animated";
import * as Graphene from "@gtkx/gi/graphene";
import * as Gsk from "@gtkx/gi/gsk";
import { GtkFixed, GtkFixedLayoutChild, GtkLabel } from "@gtkx/jsx/gtk";

const AnimatedFixedLayoutChild = animated(GtkFixedLayoutChild);

const place = (x: number, y: number, angle: number): Gsk.Transform | null =>
    Gsk.Transform.new().translate(new Graphene.Point({ x, y }))?.rotate(angle) ?? null;

export const Corner = ({ x, y, angle }: { x: number; y: number; angle: number }) => {
    const spring = useSpring({ to: { x, y, angle } });

    return (
        <GtkFixed>
            <AnimatedFixedLayoutChild transform={to([spring.x, spring.y, spring.angle], place)}>
                <GtkLabel label="GTKX" />
            </AnimatedFixedLayoutChild>
        </GtkFixed>
    );
};
```

That is the `Transforms` page in the video. Elsewhere, animate the margins, the size requests, or a `Gtk.Paned`'s `position`.

## Styling what has no property

Some of what you want to animate is not a GObject property at all. There is no `color` on a `Gtk.Label`, no `background` on a `Gtk.Box`, no `border-radius` anywhere. GTK4 exposes those through CSS and nothing else, which until now put them out of reach of a spring.

1.3 adds a [`style`](/guide/css) prop to every widget:

```tsx
<GtkBox style={{ background: "var(--card-bg-color)", borderRadius: 12, padding: 18 }} />;
```

GTK4 has no inline styles, so the object compiles to one rule in a `Gtk.CssProvider` that belongs to that widget alone, at a priority above `cssClasses`. Changing the object rewrites that one rule rather than minting another, which is what makes it safe to drive from a spring at sixty frames a second:

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

The spring carries a number and the interpolation builds the declaration around it. GTK4's `mix()` blends two colors by a fraction and `alpha()` scales one's opacity, so a color animation is a number animation.

A spring can also sit on a single declaration rather than on the whole prop, so the object a spring hook returns goes straight to `style` the way it does on the web:

```tsx
const styles = useSpring({ from: { color: "red" }, to: { color: "blue" } });

<AnimatedLabel style={styles} label="Due today" />;
```

`style` is typed as a curated list of the properties GTK4 actually understands, not the whole web set. GTK4 CSS covers paint and typography and has no layout, so <span v-pre>`style={{ display: "flex" }}`</span> fails to compile rather than turning into a runtime warning you have to notice — width, alignment and spacing stay in the widget's own props, where GTK puts them.

## The rest of React Spring is the same React Spring

`useSpring`, `useSprings`, `useTrail`, `useTransition`, `useChain` and `useSpringRef`, `useSpringValue` and its imperative `start`, `pause`, `resume` and `set`, the `Spring`, `Trail` and `Transition` render-prop components, `config`, `easings`, `to`, `SpringValue`, `Controller` and the types — all exported from `@gtkx/animated`, all behaving as the React Spring documentation describes them.

The exceptions are the three hooks that read the DOM. `useScroll`, `useResize` and `useInView` have no GTK counterpart and are not exported.

## Frames come from the GTK frame clock

React Spring's scheduler is repointed at GTK. Animations advance in the update phase of the newest mapped window's frame clock, so writes land before that window lays out and paints, in step with the display rather than a timer that happens to fire at roughly the right moment.

Windows come and go, so the driver does too: when the driving window is unmapped, another mapped window picks the animations up, and if the clock stops ticking, that window is set aside for a moment and a different one takes over. When no window is mapped at all, a timer paces the frames, so a spring still reaches its target and its `onRest` still fires.

## Reduced motion is two settings, not one

The web has one `prefers-reduced-motion`. GTK has two, and they mean different things.

`gtk-enable-animations` is the toolkit-wide switch, and `@gtkx/animated` follows it the way GTK's own transitions do: while animations are off, every spring jumps to its target and the rest of the lifecycle — `onChange`, `onRest` — runs as usual. `gtk-interface-reduced-motion`, on GTK 4.22 and later, is the desktop preference behind the `prefers-reduced-motion` media query, and it asks for *less* motion rather than none. Springs keep running, and the component decides what to reduce:

```tsx
import { useReducedMotion, useSpring } from "@gtkx/animated";

const isReduced = useReducedMotion();

const styles = useSpring({
    to: { opacity: 1, marginStart: 0 },
    from: { opacity: 0, marginStart: isReduced === true ? 0 : 32 },
});
```

`useReducedMotion()` reports `true` in either case, `false` otherwise, and `null` before a display is open, and it re-renders when the settings change. It replaces React Spring's own hook, which reads a media query that does not exist here.

In tests, [`render`](/guide/testing) from `@gtkx/testing` disables animations unless it is given `areAnimationsEnabled: true`, so a spring lands on its final value on the first frame and `findBy*` and `waitFor` resolve right away instead of after the animation's duration.

## Also in 1.3

Cairo has moved out of the generated binding store into its own package, [`@gtkx/cairo`](/guide/cairo). Contexts, surfaces, patterns, regions, matrices and fonts are real classes now, so `surface instanceof ImageSurface` and `ctx.getSource() instanceof LinearPattern` narrow the way you would expect, and constructors throw on a cairo error instead of handing back an object you had to `status()`-check. `@gtkx/gi/cairo` is deprecated but keeps working for all of 1.x as a re-export, so existing imports carry on and adding the dependency is the whole migration.

[`registerClass`](/guide/subclassing) grew most of what was missing: `signals` with parameter types, return types, flags and accumulators; a `classInit` hook that hands you the new type's class struct, so `Gtk.WidgetClass.installAction` and `setLayoutManagerType` are reachable; `abstract: true`; and `paramSpecOverride` for redeclaring a property a parent or an interface already carries. Every `GObject.ParamSpec` now exposes its `name`, `nick`, `blurb`, `flags`, `valueType` and `ownerType`.

Two things got easier to pass. A GType parameter accepts the registered class alongside the numeric GType, so `Gio.ListStore.new(Gtk.Label)` works, and a `const GValue *` parameter accepts a plain JavaScript value with the GType inferred, the way GJS does it. Both are documented in [Configuration and codegen](/guide/configuration-and-codegen).

The rest is correctness: required arguments and flag values are validated instead of marshalled as garbage, UCS-4 arrays and caller-allocated fixed arrays bind, fundamental identity survives a round trip through C, an error thrown out of a vfunc reaches the C caller as a real `GError`, and ownership transfer for structs, boxed types and fundamentals no longer leaks or double-frees.

## Upgrading

There are breaking changes in 1.3, and most of them can reach code that works today.

Some C functions are gone from the generated store. They double-free, hop threads, or hand raw pointers across the boundary, and no amount of care at the call site makes them safe: the `g_object_*_data` and `*_qdata` family, `g_thread_new` and friends, the ref-counted string functions, and the in-place string mutators that return their own argument. A callable whose callback parameter has a `closure` or `destroy` index that is not adjacent to it is dropped for the same reason. Where a replacement exists it is the obvious one:

```diff
-const isRevoked = receiver.getData("revoked") !== null;
+const isRevoked = receiver.isFloating();
```

A method named `on<SignalName>` is now installed as that signal's class-closure default handler, GJS-style, when the type actually carries a signal of that name. This is new behavior applied to old code: a helper you called `onShow` on a `Gtk.Widget` subclass now runs on every `show` emission. Rename any `on`-prefixed method that was never meant to be a handler. A name that does not match a real signal is left alone.

Several things throw where they used to limp along: a missing required argument, an invalid flag value, a cairo constructor whose cairo call failed, and a `registerClass` call with a `typeName` GObject will not accept, a `cssName` on a non-widget class, or a signal the parent already carries.

Nothing is removed yet, but `Gdk.RGBA.create`, the `Graphene.Point`, `Rect` and `Size` `create` helpers, and the `@gtkx/gi/cairo` subpath are all deprecated and go away in 2.0.

One change is quieter. `@media (prefers-color-scheme: dark)`, `prefers-contrast` and `prefers-reduced-motion` blocks inside a [`css`](/guide/css) template used to be inert. They apply now, so rules that were silently dead take effect on the next run.

## What's next

The [roadmap](https://github.com/orgs/gtkx-org/projects/1) continues with [`@gtkx/navigation`](https://github.com/gtkx-org/gtkx/issues/479) on top of Adwaita and React Navigation (shipped in [1.4](/blog/gtkx-1-4)), and [`@gtkx/forms`](https://github.com/gtkx-org/gtkx/issues/480). That order is not fixed; if something else would help you more, the [issue tracker](https://github.com/gtkx-org/gtkx/issues) is where it gets argued about.

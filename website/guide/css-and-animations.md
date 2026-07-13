---
description: "Style native widgets with the @gtkx/css tagged template and GTK's own CSS engine, and animate them declaratively with @gtkx/animate on top of libadwaita's animation primitives."
---

# CSS and Animations

GTK4 styles widgets with a real CSS engine of its own, and every widget carries a list of CSS classes through its `css-classes` property, which gtkx exposes as the `cssClasses` prop on every JSX element. Two packages build on that foundation. `@gtkx/css` is Emotion-style CSS-in-JS: you write styles next to your components, and it hands back class names that GTK resolves. `@gtkx/animate` is a Framer-Motion-style animation layer: you declare `initial`, `animate`, and `exit` targets on a widget, and libadwaita's animation engine drives the frames.

## The `css` tagged template

`css` from `@gtkx/css` accepts a tagged template (or Emotion object styles, or arrays of either), serializes it, registers the resulting rules with GTK, and returns a generated class name of the form `gtkx-<hash>`. The hash comes from the serialized style content, so identical styles produce the same class and are only inserted once. That string goes straight into `cssClasses`:

```ts
import { css } from "@gtkx/css";

export const listDot = (color: string): string => css`
    min-width: 12px;
    min-height: 12px;
    border-radius: 9999px;
    background: ${color};
`;

export const addRow = css`
    background: alpha(@accent_bg_color, 0.08);
`;
```

```tsx
<GtkBox cssClasses={[listDot(list.color)]} />
<GtkListBoxRow cssClasses={[addRow]} />
```

Interpolation is ordinary JavaScript: `listDot` produces one class per distinct color and reuses the class when called with the same color again. You can also interpolate a previously generated class name into another `css` call, and its styles are inlined rather than referenced, exactly as Emotion composition works.

Behind the scenes there is a single shared `Gtk.CssProvider` attached to the default display at `STYLE_PROVIDER_PRIORITY_APPLICATION`. Every `css` call appends its rules to one stylesheet string, and updates are batched per microtask into a single `loadFromString` reload, so a render pass that creates a dozen styles costs one provider update. In development, the provider's `parsing-error` signal is logged as a warning, so a property GTK does not understand tells you immediately instead of failing silently.

## GTK CSS is its own dialect

The syntax is CSS, but the vocabulary is GTK's. Selectors match widget node names (`window`, `button`, `entry`) rather than HTML tags, the set of supported properties is GTK's own (there is no `display: flex`; layout belongs to containers and layout managers), and the theme exports named colors you reference with an `@` prefix, as `alpha(@accent_bg_color, 0.08)` does above. Treat the [GTK CSS overview](https://docs.gtk.org/gtk4/css-overview.html) and [property reference](https://docs.gtk.org/gtk4/css-properties.html) as the source of truth for what you can write, and the Adwaita [named colors](https://gnome.pages.gitlab.gnome.org/libadwaita/doc/main/css-variables.html) as your palette. `@gtkx/css` protects named colors from its own compiler: any `@identifier` that is not `define-color`, `import`, `keyframes`, or `media` is treated as a named color rather than an at-rule.

Nesting works the way you expect from Emotion, with `&` referring to the generated class:

```tsx
import { css } from "@gtkx/css";
import { GtkProgressBar } from "@gtkx/jsx/gtk";

const progressStyle = css`
    &.hidden {
        opacity: 0;
    }
`;

<GtkProgressBar fraction={progress} cssClasses={[progressStyle, isLoading ? "" : "hidden"]} />;
```

`@keyframes` blocks are written inline inside the template and emitted as top-level rules, so a class can carry its own animation:

```ts
const rainbow = css`
    animation: rainbow 1s infinite linear;

    @keyframes rainbow {
        0% { background: linear-gradient(0deg, red, orange, yellow, green, blue, purple); }
        50% { background: linear-gradient(180deg, red, orange, yellow, green, blue, purple); }
        100% { background: linear-gradient(360deg, red, orange, yellow, green, blue, purple); }
    }
`;
```

## Combining classes with `cx`

GTK's `css-classes` property is a string array, so `cx` returns a `string[]` rather than a space-joined string. It filters out falsy tokens, which makes conditional classes read naturally, and it mixes generated classes freely with the style classes Adwaita ships (`flat`, `pill`, `suggested-action`, `dim-label`, and friends):

```tsx
import { css, cx } from "@gtkx/css";
import { GtkButton } from "@gtkx/jsx/gtk";

const swatch = css`
    min-width: 48px;
    min-height: 32px;
    border-radius: 4px;
`;

<GtkButton cssClasses={cx(swatch, isSelected && "suggested-action")} />;
```

When two or more gtkx-generated classes appear in one `cx` call, their styles are concatenated in argument order and re-emitted as a single merged class, so the last argument wins on conflicting properties. This exists because the order of classes on a GTK widget does not encode precedence, so merging is the only way to make `cx(base, override)` mean what it says. Raw class names pass through untouched.

## Global styles

`injectGlobal` inserts rules without scoping them to a generated class, which is how you target widget node names or define theme-wide rules:

```ts
import { injectGlobal } from "@gtkx/css";

injectGlobal`
    window {
        background: @theme_bg_color;
    }
`;
```

Importing a plain `.css` file works too: the gtkx CLI compiles the import into an `injectGlobal` call with the file's content, so a hand-written stylesheet and template-literal styles end up in the same provider.

The last export, `registerProviderForDefaultDisplay(priority?)`, is the primitive both packages use internally: it creates a `Gtk.CssProvider`, attaches it to the default display (or to the first display that opens), and returns it. Reach for it only when you need your own provider at a custom priority.

## Animating widgets with `animated`

`@gtkx/animate` wraps any widget so that it accepts animation props. Access an intrinsic element through the `animated` proxy (`animated.GtkLabel`, `animated.GtkButton`, any element whose instance is a `Gtk.Widget`), or wrap a custom component with `animated(MyComponent)`. The wrapped component takes everything the original takes, plus:

- `initial`: the state the widget starts from before its enter animation, or `false` to skip the enter animation and apply `animate` directly.
- `animate`: the state the widget animates to while present. Changing it starts a new animation, but only when the new target is not shallow-equal to the previous one.
- `exit`: the state the widget animates to while leaving, inside an `AnimatePresence`.
- `transition`: timing and physics, described below.
- `onAnimationStart` and `onAnimationComplete` callbacks.

A target is an `AnimationTarget`: `opacity`, `x` and `y` (pixel translation), `scale`, `scaleX`, `scaleY`, `rotate` (degrees), `skewX`, and `skewY`. Every field is optional.

```tsx
import { animated } from "@gtkx/animate";

<animated.GtkButton
    label="Save"
    initial={{ opacity: 0 }}
    animate={{ opacity: 1 }}
    transition={{ duration: 0.1 }}
/>;
```

Under the hood this is libadwaita, not a JavaScript timer loop. A tween builds an `Adw.TimedAnimation` and a spring builds an `Adw.SpringAnimation`, each driving an `Adw.CallbackAnimationTarget` that interpolates between the from and to targets and writes the result as `opacity` and `transform` CSS. Each animated widget gets a unique `gtkx-anim-<id>` class whose rule lives in a shared animation provider registered one priority above the `css()` provider, so animated values always win over your static styles, and the class and its rule are removed on unmount.

## Tweens and springs

`transition.type` selects between the two, and defaults to `"tween"`:

- **Tween**: `duration` in seconds (default 0.3), `ease` as one of forty-one named curves (`"linear"`, `"easeOut"` is the default, `"easeInOutCubic"`, `"backOut"`, and so on, each resolving to an `Adw.Easing` value, which you can also pass directly), `delay` in seconds, `reverse`, `repeat` (additional repetitions, a non-finite value repeats forever), and `repeatType` (`"loop"`, `"reverse"`, or `"mirror"`).
- **Spring**: physics parameters `stiffness`, `damping`, and `mass` (defaults 100, 10, 1), or a `dampingRatio`, or the perceptual pair `visualDuration` and `bounce` from which the physics are derived, plus `velocity`, `epsilon`, and `clamp`, which prevents overshoot.

Both kinds honor the system's "enable animations" accessibility setting by default; pass `followEnableAnimations: false` to opt an animation out when its motion is essential.

```tsx
<animated.GtkLabel
    label="Bouncy"
    initial={{ x: -100 }}
    animate={{ x: 0 }}
    transition={{ type: "spring", damping: 1, stiffness: 200, mass: 1 }}
/>;
```

## Exit animations with `AnimatePresence`

React unmounts a widget the instant it leaves the tree, which leaves no time for a leave animation. `AnimatePresence` fixes that the same way Framer Motion does: it keeps removed children mounted until their exit animations complete. Each direct child needs a stable, unique `key`; a child without one is dropped from the rendered output, with a one-time development warning.

```tsx
import { AnimatePresence, animated } from "@gtkx/animate";
import { GtkBox } from "@gtkx/jsx/gtk";

<GtkBox>
    <AnimatePresence>
        {showToast && (
            <animated.GtkLabel
                key="toast"
                label="Saved"
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 12 }}
                transition={{ duration: 0.2 }}
            />
        )}
    </AnimatePresence>
</GtkBox>;
```

`AnimatePresence` takes three props besides `children`. `initial` (default `true`) controls whether children already present on the first render run their enter animations; pass `false` to mount children directly in their `animate` state and animate only subsequent changes. `mode` chooses how entering and exiting children overlap: `"sync"` (the default) runs both at once, while `"wait"` finishes every exit before the entering children mount, which is what you want when two views occupy the same slot. `onExitComplete` fires once after all exiting children have finished, useful for sequencing work behind a departure. A child removed without an `exit` prop still exits cleanly; it is simply removed as soon as its (empty) exit animation completes.

::: tip
In tests, `render` from `@gtkx/testing` disables animations by default so assertions see final states immediately. Pass `render(element, { animations: true })` when the animation itself is what you are testing. See [Testing](/guide/testing) for the full model.
:::

## Dark style and theming

Light and dark are not a CSS concern in GTK: libadwaita centralizes the color scheme on `Adw.StyleManager`, a process-wide singleton from `@gtkx/gi/adw` you drive imperatively with `setColorScheme`, and every named color you used above re-resolves automatically when the scheme flips. The [Preferences and Theming](/tutorial/preferences-and-theming) tutorial chapter walks the complete pattern in the Tasks app: a GSettings-backed preference, an `applyColorScheme` helper, and a preferences dialog that switches the theme live.

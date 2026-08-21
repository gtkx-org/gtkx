---
title: "CSS"
description: "Style native widgets with GTK4's own CSS engine: the style prop, the @gtkx/css tagged template, generated class names, cx, global styles, and dark style."
---

# CSS

GTK4 resolves its own CSS, and GTKX gives you two ways to write it. Every widget element takes a `style` prop for the declarations that belong to that one widget, and `@gtkx/css` is Emotion-style CSS-in-JS for the ones worth naming: you write styles next to your components, and it hands back class names that GTK4 resolves.

## The `style` prop

Every element that renders a `Gtk.Widget` takes a `style` prop: an object of declarations, spelled the way React DOM spells them, that applies to that widget and nothing else.

```tsx
import { GtkLabel } from "@gtkx/jsx/gtk";

<GtkLabel label="Overdue" style={{ color: "var(--error-color)", fontWeight: 700 }} />;
```

Numbers get `px` appended, except on the properties that are unitless on the web, which are `opacity`, `fontWeight`, `lineHeight` and `animationIterationCount`, so `minHeight: 48` is `min-height: 48px`. Any other unit goes in as a string.

A key that starts with `&` nests a block under a selector built from it, the same way it works inside a `css` template:

```tsx
import { GtkButton } from "@gtkx/jsx/gtk";

<GtkButton
    label="Delete"
    style={{
        color: "var(--error-color)",
        "&:hover": { background: "alpha(var(--error-color), 0.1)" },
        "& label": { fontWeight: 700 },
    }}
/>;
```

The `&` is not optional, and the type enforces it: a bare `":hover"` key would compile to a *descendant* `:hover`, which is not what it reads like. Every rule has to start from the widget's own class, and one that does not is dropped with a warning instead of applied, so a declaration cannot break out of its block and repaint the rest of the window. A combinator after the `&` does reach past the widget on purpose, which is what `& label` above relies on.

Setting the prop to `undefined` or `null` removes the declarations again. A spring can drive the whole object or an individual declaration; see [Animations](/guide/animations).

### GTK4 CSS has no layout

GTK4's CSS engine covers paint and typography, and stops there. Colors, backgrounds, borders and border radius, shadows, outlines, filters, fonts, letter spacing, text decoration, `transform`, `transition` and `animation` all resolve, and so do `padding`, `margin`, `min-width` and `min-height`. There is no `width`, `height`, `display`, `position`, `flex-direction`, `gap`, `text-align`, `cursor`, `z-index` or `overflow`: GTK4 has no such properties, and a rule that sets one is reported as a warning during development and then ignored.

Layout belongs to the widget instead, so it stays in props. `widthRequest` and `heightRequest` ask for a size, `halign`, `valign`, `hexpand` and `vexpand` place a widget in the space it is given, a `GtkBox`'s `orientation` and `spacing` lay out a row or a column, a `GtkLabel`'s `xalign` and `justify` align text, and a `GtkScrolledWindow` is what clips and scrolls. `style` is typed as a curated list of properties rather than the whole web set for this reason: <span v-pre>`style={{ display: "flex" }}`</span> fails to compile, instead of turning into a runtime warning you have to notice.

### Choosing between `style` and a class

Reach for `style` when the declarations belong to one widget and nowhere else: a color derived from data, a one-off `min-height`, a `transform` a spring is driving. Reach for `css` and `cssClasses` when they are worth naming, when several widgets share the same look, or when you need something `style` deliberately cannot express, such as `@keyframes`, a `@media` query, a custom property, a `-gtk-` property, or a selector that does not start from the widget it is written on. The two mix on one element, and `cssClasses` keeps whatever you put in it.

### One provider per widget

Each styled widget gets a `Gtk.CssProvider` of its own holding exactly one rule, keyed by a class the reconciler adds to the widget, so changing `style` reparses that one rule and no other CSS in the app. GTK still invalidates the display's style on every reload, though, which is work that grows with how many widgets are on screen rather than with how many of them are styled: driving `style` from a spring is cheap in a small tree, and animating many widgets at once in a large one is not. That provider sits one priority step above the stylesheet the generated classes go into, which is what makes a declaration in `style` outrank the same declaration coming from `cssClasses`. The generated class is an ordinary class named `gtkx-s` followed by a number: it shows up in `getCssClasses()` and it counts against `toHaveClass` under `{ exact: true }`. Do not write selectors against it.

## The `css` tagged template

`css` returns a generated class name for the styles you write, and that string goes straight into `cssClasses`:

```ts
import { css } from "@gtkx/css";

export const listDot = (color: string): string => css`
    min-width: 12px;
    min-height: 12px;
    border-radius: 9999px;
    background: ${color};
`;
```

```tsx
<GtkBox cssClasses={[listDot(list.color)]} />;
```

Interpolation is ordinary JavaScript, and identical styles resolve to the same class and are inserted once, so calling `css` on every render costs nothing extra. Interpolating a previously generated class name into another `css` call inlines its styles, exactly as Emotion composition works.

Adwaita exposes its palette as CSS custom properties, so use `var(--accent-bg-color)` in new styles; GTK4's own `@`-prefixed color names such as `@card_bg_color` still work. A property GTK4 does not understand is reported as a warning during development instead of failing silently.

## Transitions and keyframes

GTK4 animates from CSS, so `transition` and `animation` behave the way they do on the web, and both belong in the same `css` template as the rest of a widget's styles:

```ts
import { css } from "@gtkx/css";

export const pendingRow = css`
    background: alpha(var(--accent-bg-color), 0.08);
    transition: background 200ms ease-out;
    animation: tasks-pulse 1.2s ease-in-out infinite;

    &:hover {
        background: alpha(var(--accent-bg-color), 0.16);
    }

    @keyframes tasks-pulse {
        50% {
            background: alpha(var(--accent-bg-color), 0.24);
        }
    }
`;
```

Keyframes names are global rather than hashed, so give them a prefix of your own to keep two components from claiming the same name.

## Combining classes with `cx`

`cx` returns a `string[]` for `cssClasses`, drops falsy tokens, and mixes generated classes freely with the style classes Adwaita ships, such as `suggested-action`:

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

When two or more generated classes appear in one `cx` call, they merge into a single class and the last argument wins on conflicting properties. Raw class names pass through untouched. A declaration in the `style` prop beats all of them whatever order they were inserted in, because the prop's own provider is registered one priority step above the stylesheet these classes live in.

## Global styles

`injectGlobal` inserts rules without scoping them to a generated class, which is how you target widget node names or define theme-wide rules:

```ts
import { injectGlobal } from "@gtkx/css";

injectGlobal`
    window {
        background: var(--window-bg-color);
    }
`;
```

Importing a plain `.css` file works too: the GTKX CLI compiles the import into an `injectGlobal` call with the file's content.

## Dark style and theming

Light or dark cannot be forced from CSS. Set the color scheme through `Adw.StyleManager` instead:

```ts
import * as Adw from "@gtkx/gi/adw";

Adw.StyleManager.getDefault().setColorScheme(Adw.ColorScheme.FORCE_DARK);
```

Every theme color re-resolves automatically when the scheme flips. To vary your own rules by scheme, wrap them in `@media (prefers-color-scheme: dark)` inside a `css` template:

```ts
import { css } from "@gtkx/css";

export const card = css`
    background: var(--card-bg-color);
    box-shadow: 0 1px 3px var(--shade-color);

    @media (prefers-color-scheme: dark) {
        box-shadow: none;
    }
`;
```

The query follows whatever the app resolves to, so it tracks both the desktop's preference and a scheme the app forces through `Adw.StyleManager`. `@media (prefers-contrast: more)` follows the system's high-contrast preference the same way, and `@media (prefers-reduced-motion: reduce)` does too on GTK 4.22 or later.

The [Preferences and Theming](/tutorial/preferences-and-theming) tutorial chapter builds a preference that switches the scheme at runtime.

## Next

Continue with [Animations](/guide/animations) to drive widget properties with springs.

---
title: "CSS"
description: "Style native widgets with the @gtkx/css tagged template and GTK4's own CSS engine: generated class names, cx, global styles, and dark style."
---

# CSS

`@gtkx/css` is Emotion-style CSS-in-JS: you write styles next to your components, and it hands back class names that GTK4 resolves.

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

When two or more generated classes appear in one `cx` call, they merge into a single class and the last argument wins on conflicting properties. Raw class names pass through untouched.

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

Continue with [OpenGL](/guide/opengl) to draw with the GPU inside a widget.

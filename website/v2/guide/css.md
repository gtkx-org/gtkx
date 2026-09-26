---
title: "CSS"
description: "Apply widget styles and reusable classes in GTKX."
---

# CSS

GTKX provides a `style` prop for individual widgets and `@gtkx/css` for reusable styles. Start with [Adwaita's style classes](https://gnome.pages.gitlab.gnome.org/libadwaita/doc/main/style-classes.html) when they cover the design. For custom rules, use [GTK's supported CSS properties](https://docs.gtk.org/gtk4/css-properties.html); layout stays in widget props.

## Style one widget

The `style` prop accepts an object with camelCase property names:

```tsx
import { GtkLabel } from "@gtkx/jsx/gtk";

<GtkLabel label="Overdue" style={{ color: "var(--error-color)", fontWeight: 700 }} />;
```

Numeric lengths use pixels: `minHeight: 48` becomes `min-height: 48px`. Pass other units as strings. Setting `style` to `undefined` or `null` removes its declarations.

Nested selectors start with `&`, which refers to the styled widget:

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

A declaration in `style` takes precedence over the same declaration supplied through `cssClasses`. GTKX adds a generated class to apply the style; leave that class under GTKX's control.

Use `style` for values that change with an individual widget. GTKX batches these updates through a shared style provider, but frequent changes still make GTK recalculate styles. Prefer native animated properties or CSS transitions when they express the effect. See [Animations](/v2/guide/animations) for animated styles.

## Create reusable classes

`css` accepts a tagged template or style object and returns a class name for `cssClasses`:

```tsx
import { css } from "@gtkx/css";
import { GtkLabel } from "@gtkx/jsx/gtk";

const overdue = css`
    color: var(--error-color);
    font-weight: 700;

    &:hover {
        text-decoration: underline;
    }
`;

<GtkLabel label="Overdue" cssClasses={[overdue]} />;
```

Identical styles reuse the same class and are inserted once. Interpolating a generated class into another `css` call includes its declarations. Use these classes for styles shared by several widgets, or for rules such as `@media` and `@keyframes` that the `style` prop does not expose. Keyframe names are global, so give them an application or component prefix.

## Combine classes

`cx` returns the array that `cssClasses` expects. It drops empty and conditional values while preserving ordinary class names:

```tsx
import { css, cx } from "@gtkx/css";
import { GtkButton } from "@gtkx/jsx/gtk";

const action = css({ minWidth: 96 });

<GtkButton label="Save" cssClasses={cx(action, canSave && "suggested-action")} />;
```

When several generated classes are combined, `cx` merges their declarations into one class. Later arguments win on conflicting properties.

## Apply global rules

`injectGlobal` inserts selectors without a generated class:

```ts
import { injectGlobal } from "@gtkx/css";

injectGlobal`
    window {
        background: var(--window-bg-color);
    }
`;
```

A plain `.css` import also works: the GTKX CLI turns it into an `injectGlobal` call. Global rules remain installed for the application's lifetime.

## Follow appearance preferences

GTKX's stylesheet follows the color scheme resolved by [Adw.StyleManager](https://gnome.pages.gitlab.gnome.org/libadwaita/doc/main/class.StyleManager.html), including an application override. It also follows the system's contrast preference and, on GTK 4.22 or later, reduced-motion preference.

Use theme variables in custom styles so their colors follow the active appearance. When a rule needs to change by preference, place its `@media` block inside `css`:

```ts
const card = css`
    background: var(--card-bg-color);
    box-shadow: 0 1px 3px var(--shade-color);

    @media (prefers-color-scheme: dark) {
        box-shadow: none;
    }
`;
```

See [Preferences and Theming](/v2/tutorial/preferences-and-theming) for an application preference that switches the scheme.

## Use a bundled font

A `?font` import bundles the font and returns its family name. Pass that name directly to `fontFamily`:

```tsx
import bodyFont from "../data/fonts/Inter-Regular.otf?font";

<GtkLabel label="Bundled" style={{ fontFamily: bodyFont }} />;
```

To add a font for fallback coverage without selecting it, use a side-effect import such as `import "../data/fonts/NotoSansKR.otf?font";`. See [Import project data](/v2/guide/assets#import-project-data) for asset imports.

---
title: "CSS"
description: "Style native GTK widgets with scoped declarations and reusable classes."
---

# CSS

GTKX uses GTK4's CSS engine, not browser CSS. Use `style` for declarations owned by one widget and `@gtkx/css` for reusable or global rules.

## Style one widget

```tsx
<GtkButton
    label="Delete"
    style={{
        color: "var(--error-color)",
        "&:hover": { background: "alpha(var(--error-color), 0.1)" },
    }}
/>
```

Property names follow React's camel case. Numbers receive `px` except for unitless properties. Nested rules must start with `&`; GTKX drops rules that escape the widget's generated scope.

GTK CSS paints and styles typography. It does not implement browser layout: use widget props such as `widthRequest`, `halign`, `hexpand`, `orientation`, and `spacing`, and containers such as `GtkScrolledWindow`. The `style` type rejects unsupported web properties.

## Reuse a class

```ts
import { css } from "@gtkx/css";

export const pending = css`
    background: alpha(var(--accent-bg-color), 0.08);
    transition: background 200ms ease-out;

    &:hover {
        background: alpha(var(--accent-bg-color), 0.16);
    }
`;
```

Pass the returned name in `cssClasses`. Identical rules are inserted once, and interpolations are ordinary JavaScript. `cx(...)` combines generated and native classes while dropping falsy values. A `style` declaration wins over a class declaration.

Use `css` for shared rules, selectors, keyframes, media queries, custom properties, and `-gtk-` properties. Keyframe names are global, so prefix them. `injectGlobal` and imported `.css` files are for deliberate application-wide rules.

## Follow the desktop theme

Use Adwaita variables such as `var(--accent-bg-color)`. Change light or dark preference through `Adw.StyleManager`, not CSS. Media queries for `prefers-color-scheme`, `prefers-contrast`, and, on GTK 4.22 or later, `prefers-reduced-motion` follow system settings.

The [`@gtkx/css` reference](/reference/@gtkx/css/) lists the helpers. Continue with [Animations](/guide/animations) for spring-driven properties and styles.

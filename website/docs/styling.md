# Styling

GTKX provides a CSS-in-JS styling system through the `@gtkx/css` package, offering an API similar to Emotion.

## Overview

GTK uses CSS for styling, but with its own syntax and properties. GTKX bridges the gap by letting you write styles in JavaScript that get applied to GTK widgets.

```tsx
import { css } from "@gtkx/css";

const buttonStyle = css`
    background: #3584e4;
    color: white;
    padding: 8px 16px;
    border-radius: 6px;
`;

<GtkButton cssClasses={[buttonStyle]} label="Styled Button" />
```

## Nesting

The `css` function supports nesting with `&`:

```typescript
const buttonStyle = css`
    background: #3584e4;

    &:hover {
        background: #1c71d8;
    }

    &:disabled {
        opacity: 0.5;
    }
`;
```

## GTK CSS Reference

GTK CSS is similar to web CSS but with its own selectors, properties, and theme variables. For the full reference, see:

- [GTK4 CSS Overview](https://docs.gtk.org/gtk4/css-overview.html) — Selectors, properties, and `@theme_*` variables
- [Libadwaita Style Classes](https://gnome.pages.gitlab.gnome.org/libadwaita/doc/main/style-classes.html) — Built-in CSS classes for typography, buttons, and containers

## Practical Examples

### Themed Card

```typescript
const cardStyle = css`
    background: @theme_bg_color;
    border: 1px solid @borders;
    border-radius: 12px;
    padding: 16px;

    &:hover {
        background: alpha(@theme_fg_color, 0.05);
    }
`;

<GtkBox cssClasses={[cardStyle]} orientation={Gtk.Orientation.VERTICAL} spacing={8}>
    <GtkLabel label="Card Title" cssClasses={["title-3"]} />
    <GtkLabel label="Card content goes here" cssClasses={["dim-label"]} />
</GtkBox>
```

### Conditional Styling

```typescript
const itemStyle = css`
    padding: 8px 12px;
    border-radius: 6px;
`;

const selectedStyle = css`
    background: @theme_selected_bg_color;
    color: @theme_selected_fg_color;
`;

<GtkBox orientation={Gtk.Orientation.VERTICAL} spacing={0} cssClasses={[cx(itemStyle, isSelected && selectedStyle)]}>
    {item.name}
</GtkBox>
```

### Global Application Styles

```typescript
// styles/global.ts
import { injectGlobal } from "@gtkx/css";

injectGlobal`
    window {
        background: @theme_bg_color;
    }

    .sidebar {
        background: alpha(@theme_bg_color, 0.95);
        border-right: 1px solid @borders;
    }

    .content-area {
        padding: 24px;
    }
`;
```

Import in your app entry:

```tsx
import "./styles/global.js";
```

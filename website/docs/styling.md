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

## API Reference

### `css`

Creates a scoped CSS class from styles.

```typescript
import { css } from "@gtkx/css";

// Template literal syntax
const className = css`
    background: red;
    padding: 12px;
`;

// Object syntax
const className = css({
    background: "red",
    padding: "12px",
});

// Composition
const baseStyle = css`padding: 4px;`;
const combined = css(baseStyle, { margin: "8px" });
```

The function returns a unique class name (prefixed with `gtkx-`) that you pass to the `cssClasses` prop.

**Caching:** Identical styles return the same class name, avoiding duplicate CSS rules.

### `cx`

Combines multiple class names, filtering out falsy values.

```typescript
import { cx } from "@gtkx/css";

const className = cx(
    "base-class",
    isActive && "active",
    isDisabled && "disabled",
    undefined,
    null
);
// Result: "base-class active" (if isActive is true, isDisabled is false)
```

Useful for conditional styling:

```tsx
<GtkButton
    cssClasses={[cx(
        buttonStyle,
        isLoading && loadingStyle,
        isPrimary && "suggested-action"
    )]}
/>
```

### `injectGlobal`

Injects global CSS rules without class scoping.

```typescript
import { injectGlobal } from "@gtkx/css";

injectGlobal`
    window {
        background: @theme_bg_color;
    }

    button {
        border-radius: 6px;
    }

    .my-custom-class {
        font-weight: bold;
    }
`;
```

Use sparingly—prefer scoped styles with `css()` when possible.

## GTK CSS Syntax

GTK CSS is similar to web CSS but has some differences.

### Selectors

GTK uses widget type names as selectors:

```css
/* Widget type selectors */
button { }
label { }
entry { }
window { }

/* Class selectors (same as web) */
.suggested-action { }
.destructive-action { }

/* Pseudo-classes */
button:hover { }
button:active { }
button:disabled { }
button:focus { }
button:checked { }    /* For toggle buttons */
```

### Nesting with `&`

```typescript
const buttonStyle = css`
    background: #3584e4;

    &:hover {
        background: #1c71d8;
    }

    &:active {
        background: #1a5fb4;
    }

    &:disabled {
        opacity: 0.5;
    }
`;
```

### Theme Variables

GTK provides CSS variables for theme colors:

```typescript
const themedStyle = css`
    background: @theme_bg_color;
    color: @theme_fg_color;
    border-color: @borders;
`;
```

Common theme variables:

| Variable | Description |
|----------|-------------|
| `@theme_bg_color` | Background color |
| `@theme_fg_color` | Foreground/text color |
| `@theme_selected_bg_color` | Selected item background |
| `@theme_selected_fg_color` | Selected item text |
| `@borders` | Border color |
| `@warning_color` | Warning accent |
| `@error_color` | Error accent |
| `@success_color` | Success accent |

### GTK-Specific Properties

Some properties differ from web CSS:

```css
/* Margins use margin-start/margin-end for RTL support */
margin-start: 12px;
margin-end: 12px;
margin-top: 8px;
margin-bottom: 8px;

/* Or shorthand (same as web) */
margin: 8px 12px;

/* Font styling */
font-family: "Cantarell";
font-size: 14px;
font-weight: bold;

/* Borders */
border: 1px solid @borders;
border-radius: 6px;

/* Colors with alpha */
background: alpha(@theme_bg_color, 0.5);
color: mix(@theme_fg_color, @theme_bg_color, 0.5);
```

## Adwaita CSS Classes

Libadwaita provides built-in CSS classes for common patterns:

### Typography

```tsx
<GtkLabel cssClasses={["title-1"]} label="Heading 1" />
<GtkLabel cssClasses={["title-2"]} label="Heading 2" />
<GtkLabel cssClasses={["title-3"]} label="Heading 3" />
<GtkLabel cssClasses={["title-4"]} label="Heading 4" />
<GtkLabel cssClasses={["heading"]} label="Section Heading" />
<GtkLabel cssClasses={["body"]} label="Body text" />
<GtkLabel cssClasses={["caption"]} label="Small caption" />
<GtkLabel cssClasses={["dim-label"]} label="Dimmed text" />
```

### Buttons

```tsx
<GtkButton cssClasses={["suggested-action"]} label="Primary" />
<GtkButton cssClasses={["destructive-action"]} label="Danger" />
<GtkButton cssClasses={["flat"]} label="Flat" />
<GtkButton cssClasses={["pill"]} label="Pill Shape" />
<GtkButton cssClasses={["circular"]} label="+" />
<GtkButton cssClasses={["raised"]} label="Raised" />
```

### Containers

```tsx
<GtkBox cssClasses={["card"]} />
<GtkListBox cssClasses={["boxed-list"]} />
<GtkBox cssClasses={["toolbar"]} />
<GtkBox cssClasses={["osd"]} />  {/* On-screen display style */}
```

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

<GtkBox cssClasses={[cardStyle]} orientation={Gtk.Orientation.VERTICAL}>
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

<GtkBox cssClasses={[cx(itemStyle, isSelected && selectedStyle)]}>
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

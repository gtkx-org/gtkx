---
sidebar_position: 4
---

# Styling

The `@gtkx/css` package provides CSS-in-JS styling for GTK widgets, with an API similar to Emotion.

## css

Create scoped CSS classes with the `css` template literal:

```tsx
import { css } from '@gtkx/css';
import { GtkButton } from '@gtkx/react';

const buttonStyle = css`
    padding: 16px 32px;
    border-radius: 24px;
    background: #3584e4;
    color: white;
`;

<GtkButton label="Click" cssClasses={[buttonStyle]} />
```

The function returns a unique class name string. Pass it to the `cssClasses` prop as an array element.

### Nested Selectors

Use `&` to reference the current selector for pseudo-classes and states:

```tsx
const interactiveButton = css`
    background: #3584e4;
    transition: all 200ms ease;

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

GTK supports these pseudo-classes:
- `:hover` - Mouse over
- `:active` - Being clicked
- `:focus` - Has keyboard focus
- `:disabled` - Widget is insensitive
- `:checked` - Toggle buttons, checkboxes
- `:selected` - Selected items in lists
- `:backdrop` - Window is not focused

### Descendant Selectors

Target child widgets:

```tsx
const cardStyle = css`
    padding: 12px;
    background: @theme_bg_color;

    & label {
        font-weight: bold;
    }

    & button {
        margin-top: 8px;
    }
`;
```

## cx

Combine multiple class names with `cx`:

```tsx
import { css, cx } from '@gtkx/css';

const base = css`
    padding: 12px;
    border-radius: 8px;
`;

const primary = css`
    background: #3584e4;
    color: white;
`;

const large = css`
    padding: 20px 40px;
    font-size: 18px;
`;

<GtkButton cssClasses={[cx(base, primary)]} />
<GtkButton cssClasses={[cx(base, primary, large)]} />
```

`cx` filters out falsy values for conditional styling:

```tsx
<GtkButton
    cssClasses={[cx(
        baseStyle,
        isActive && activeStyle,
        isDisabled && disabledStyle
    )]}
/>
```

## injectGlobal

Apply global styles that target widget types:

```tsx
import { injectGlobal } from '@gtkx/css';

injectGlobal`
    window {
        background: @theme_bg_color;
    }

    button {
        border-radius: 6px;
    }

    entry {
        min-height: 36px;
    }
`;
```

Global styles apply to all matching widgets. Use for:
- Application-wide defaults
- Widget type styling
- Theme customization

## GTK Theme Variables

GTK provides theme variables that respect the user's system theme:

| Variable | Description |
|----------|-------------|
| `@theme_bg_color` | Background color |
| `@theme_fg_color` | Foreground/text color |
| `@theme_base_color` | Base background (entries, views) |
| `@theme_text_color` | Text on base background |
| `@theme_selected_bg_color` | Selection background |
| `@theme_selected_fg_color` | Selection foreground |
| `@borders` | Border color |
| `@theme_accent_color` | Accent color (GTK 4.6+) |

```tsx
const themedCard = css`
    background: @theme_bg_color;
    color: @theme_fg_color;
    border: 1px solid @borders;
    border-radius: 12px;
    padding: 16px;
`;
```

Using theme variables ensures your app looks correct in both light and dark modes.

## GTK-Specific CSS Properties

GTK CSS differs from web CSS. Supported properties include:

### Box Model
- `margin`, `margin-top`, `margin-right`, `margin-bottom`, `margin-left`
- `padding`, `padding-top`, `padding-right`, `padding-bottom`, `padding-left`
- `border`, `border-radius`, `border-color`, `border-width`
- `min-width`, `min-height`

### Colors and Backgrounds
- `color`
- `background`, `background-color`, `background-image`
- `opacity`
- `box-shadow`

### Typography
- `font-family`, `font-size`, `font-weight`, `font-style`
- `text-decoration`
- `letter-spacing`

### Transitions
- `transition`
- `transition-property`, `transition-duration`, `transition-timing-function`

### Not Supported
- `display`, `position`, `float` (GTK uses its own layout system)
- `width`, `height` (use `min-width`, `min-height` or widget props)
- Flexbox, Grid (use `GtkBox`, `GtkGrid` widgets)

## Widget-Specific Styling

GTK widgets have specific CSS nodes. Target them with type selectors:

```tsx
injectGlobal`
    button.suggested-action {
        background: @theme_selected_bg_color;
    }

    entry {
        background: @theme_base_color;
    }

    headerbar {
        background: @theme_bg_color;
    }

    label.title {
        font-weight: bold;
        font-size: 18px;
    }
`;
```

### Built-in Style Classes

GTK provides built-in style classes:

| Class | Description |
|-------|-------------|
| `suggested-action` | Primary/suggested action button |
| `destructive-action` | Destructive action button |
| `flat` | Flat button style |
| `circular` | Circular button |
| `title` | Title text |
| `heading` | Heading text |
| `dim-label` | Dimmed label |
| `error` | Error state |
| `warning` | Warning state |
| `success` | Success state |

Apply them alongside custom classes:

```tsx
<GtkButton
    label="Delete"
    cssClasses={['destructive-action', customStyle]}
/>
```

## Style Sheet Lifecycle

Styles are injected into GTK's CSS provider when the application starts:

1. `css()` calls serialize the styles and generate class names
2. On first render, styles are queued
3. After GTK initializes, all styles are applied to the display's CSS provider
4. Subsequent `css()` calls inject styles immediately

Styles persist for the application lifetime. There's no dynamic removal.

## Example: Complete Theme

```tsx
import { css, cx, injectGlobal } from '@gtkx/css';

injectGlobal`
    window {
        background: @theme_bg_color;
    }

    headerbar {
        background: transparent;
        box-shadow: none;
    }
`;

const card = css`
    background: alpha(@theme_fg_color, 0.05);
    border-radius: 12px;
    padding: 16px;
    margin: 8px;
`;

const primaryButton = css`
    background: @theme_accent_color;
    color: white;
    padding: 12px 24px;
    border-radius: 8px;
    font-weight: bold;

    &:hover {
        filter: brightness(1.1);
    }
`;

const secondaryButton = css`
    background: transparent;
    color: @theme_fg_color;
    padding: 12px 24px;
    border: 1px solid @borders;
    border-radius: 8px;

    &:hover {
        background: alpha(@theme_fg_color, 0.1);
    }
`;
```

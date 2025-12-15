---
sidebar_position: 7
sidebar_label: Styling
---

# Styling

GTKX provides `@gtkx/css` for CSS-in-JS styling, similar to Emotion. GTK widgets can be styled using CSS, and GTKX makes it easy to create and apply custom styles.

## Installation

```bash
npm install @gtkx/css
```

## Basic Usage

Use the `css` template literal to create style classes:

```tsx
import { css } from "@gtkx/css";
import { Button } from "@gtkx/react";

const primaryButton = css`
  padding: 16px 32px;
  border-radius: 24px;
  background: #3584e4;
  color: white;
  font-weight: bold;
`;

const MyButton = () => <Button label="Click me" cssClasses={[primaryButton]} />;
```

The `css` function returns a unique class name that you pass to the `cssClasses` prop.

## Combining Styles

Use `cx` to combine multiple style classes:

```tsx
import { css, cx } from "@gtkx/css";

const baseButton = css`
  padding: 12px 24px;
  border-radius: 8px;
  font-weight: 600;
`;

const successButton = css`
  background: #33d17a;
  color: white;
`;

const dangerButton = css`
  background: #e01b24;
  color: white;
`;

// Combine base with variant
<Button cssClasses={[cx(baseButton, successButton)]} label="Success" />
<Button cssClasses={[cx(baseButton, dangerButton)]} label="Danger" />
```

## Global Styles

Use `injectGlobal` for global CSS that applies across your app:

```tsx
import { injectGlobal } from "@gtkx/css";

injectGlobal`
  window {
    background: #fafafa;
  }

  button {
    transition: background 200ms ease;
  }

  button:hover {
    filter: brightness(1.1);
  }
`;
```

## GTK CSS Properties

GTK supports a subset of CSS properties. Here are the most commonly used:

### Colors and Backgrounds

```css
background: #3584e4;
background: linear-gradient(135deg, #3584e4, #9141ac);
color: white;
opacity: 0.8;
```

### Spacing and Sizing

```css
padding: 12px;
padding: 12px 24px;
margin: 8px;
min-width: 100px;
min-height: 40px;
```

### Borders

```css
border: 1px solid #ddd;
border-radius: 8px;
border-radius: 50%; /* circular */
```

### Typography

```css
font-size: 16px;
font-weight: bold;
font-family: "Inter", sans-serif;
```

### Effects

```css
box-shadow: 0 2px 8px rgba(0, 0, 0, 0.2);
transition: background 200ms ease;
```

## Built-in CSS Classes

GTK provides built-in CSS classes that follow the GNOME Human Interface Guidelines:

### Button Variants

```tsx
// Suggested action (blue, prominent)
<Button label="Save" cssClasses={["suggested-action"]} />

// Destructive action (red, dangerous)
<Button label="Delete" cssClasses={["destructive-action"]} />

// Flat button (no background)
<Button label="Cancel" cssClasses={["flat"]} />

// Circular button
<Button iconName="list-add" cssClasses={["circular"]} />
```

### Typography Classes

```tsx
// Headings
<Label label="Title" cssClasses={["title-1"]} />
<Label label="Subtitle" cssClasses={["title-2"]} />
<Label label="Section" cssClasses={["heading"]} />

// Body text
<Label label="Caption" cssClasses={["caption"]} />
<Label label="Dimmed" cssClasses={["dim-label"]} />
```

### Container Classes

```tsx
// Card with shadow
<Box orientation={Orientation.VERTICAL} spacing={8} cssClasses={["card"]}>
  <Label label="Card content" />
</Box>

// Boxed list (for settings-style lists)
<Box orientation={Orientation.VERTICAL} spacing={0} cssClasses={["boxed-list"]}>
  {/* List items */}
</Box>
```

## Theming

GTK respects the system theme. Your app will automatically adapt to light/dark mode and the user's accent color.

### Respecting System Colors

Use GTK's CSS color variables for theme-aware colors:

```tsx
const themedButton = css`
  background: @accent_bg_color;
  color: @accent_fg_color;
`;

const themedCard = css`
  background: @card_bg_color;
  border: 1px solid @card_shade_color;
`;
```

### Common Color Variables

| Variable            | Description        |
| ------------------- | ------------------ |
| `@accent_bg_color`  | Accent background  |
| `@accent_fg_color`  | Accent foreground  |
| `@window_bg_color`  | Window background  |
| `@window_fg_color`  | Window foreground  |
| `@card_bg_color`    | Card background    |
| `@card_shade_color` | Card border/shadow |
| `@success_color`    | Success green      |
| `@warning_color`    | Warning yellow     |
| `@error_color`      | Error red          |

## Example: Custom Button Styles

```tsx
import { css, cx } from "@gtkx/css";
import { Button, Box } from "@gtkx/react";
import { Orientation } from "@gtkx/ffi/gtk";

const baseButton = css`
  padding: 16px 32px;
  border-radius: 24px;
  font-size: 16px;
  font-weight: bold;
  transition: all 200ms ease;
`;

const successStyle = css`
  background: #33d17a;
  color: white;

  &:hover {
    background: #2ec27e;
  }
`;

const warningStyle = css`
  background: #f5c211;
  color: #3d3846;

  &:hover {
    background: #e5a50a;
  }
`;

const gradientStyle = css`
  background: linear-gradient(135deg, #3584e4, #9141ac);
  color: white;

  &:hover {
    background: linear-gradient(135deg, #1c71d8, #813d9c);
  }
`;

const ButtonShowcase = () => (
  <Box orientation={Orientation.HORIZONTAL} spacing={12}>
    <Button label="Success" cssClasses={[cx(baseButton, successStyle)]} />
    <Button label="Warning" cssClasses={[cx(baseButton, warningStyle)]} />
    <Button label="Gradient" cssClasses={[cx(baseButton, gradientStyle)]} />
  </Box>
);
```

---
sidebar_position: 5
---

# CSS Styling

GTKX provides CSS-in-JS styling through the `@gtkx/css` package, offering an Emotion-like API that outputs to GTK's native CSS system.

## Installation

The CSS package is separate from the core GTKX package:

```bash
npm install @gtkx/css
# or
pnpm add @gtkx/css
```

## Basic Usage

Import the styling functions and apply them via the `cssClasses` prop:

```tsx
import { css } from "@gtkx/css";
import { ApplicationWindow, Box, Button, Label, quit, render } from "@gtkx/react";

const buttonStyle = css`
  padding: 16px 32px;
  border-radius: 12px;
  font-weight: bold;
`;

const labelStyle = css`
  font-size: 24px;
  margin-bottom: 16px;
`;

render(
  <ApplicationWindow title="Styled App" onCloseRequest={quit}>
    <Box>
      <Label.Root cssClasses={[labelStyle]} label="Hello!" />
      <Button cssClasses={[buttonStyle]} label="Styled Button" />
    </Box>
  </ApplicationWindow>,
  "com.example.app"
);
```

## API Reference

### css

Creates a CSS class from styles and injects them into GTK's CssProvider:

```tsx
import { css } from "@gtkx/css";

const cardStyle = css`
  background: @theme_bg_color;
  padding: 12px;
  border-radius: 6px;
`;

<Box cssClasses={[cardStyle]}>
  {/* Content */}
</Box>
```

The `css` function:
- Accepts template literals or style objects
- Returns a class name string
- Automatically deduplicates styles (identical styles create a single CSS rule)
- Injects rules into GTK's style system via CssProvider

### cx

Merges multiple class names, filtering out falsy values:

```tsx
import { css, cx } from "@gtkx/css";

const baseStyle = css`
  padding: 8px;
`;

const activeStyle = css`
  background: @accent_bg_color;
`;

function MyButton({ isActive }: { isActive: boolean }) {
  return (
    <Button
      cssClasses={[cx(baseStyle, isActive && activeStyle)]}
      label="Toggle"
    />
  );
}
```

This is useful for:
- Conditional styling
- Combining multiple style classes
- Mixing custom styles with GTK system classes

### keyframes

Creates CSS keyframe animations:

```tsx
import { css, keyframes } from "@gtkx/css";

const fadeIn = keyframes`
  from { opacity: 0; }
  to { opacity: 1; }
`;

const pulse = keyframes`
  0%, 100% { transform: scale(1); }
  50% { transform: scale(1.05); }
`;

const animatedStyle = css`
  animation: ${fadeIn} 0.3s ease-in;
`;

const pulsingStyle = css`
  animation: ${pulse} 2s infinite;
`;
```

### injectGlobal

Injects global CSS styles that apply to all widgets on the display:

```tsx
import { injectGlobal } from "@gtkx/css";

injectGlobal`
  window {
    background: #3584e4;
  }

  button {
    border-radius: 6px;
  }

  .card {
    padding: 12px;
    margin: 6px;
  }
`;
```

Use `injectGlobal` for:
- Application-wide theming
- Base styles for widget types
- Custom utility classes

## GTK CSS Specifics

### Selectors

GTK CSS uses widget type names as selectors (similar to HTML element selectors):

| Selector | Targets |
|----------|---------|
| `window` | Application windows |
| `button` | All buttons |
| `label` | All labels |
| `box` | Box containers |
| `entry` | Text entry fields |
| `headerbar` | Header bars |
| `scrolledwindow` | Scroll containers |

### Theme Variables

GTK provides theme color variables that adapt to the system theme:

```tsx
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
| `@theme_base_color` | Base background for inputs |
| `@theme_text_color` | Text on base backgrounds |
| `@theme_selected_bg_color` | Selected item background |
| `@theme_selected_fg_color` | Selected item foreground |
| `@accent_bg_color` | Accent background |
| `@accent_fg_color` | Accent foreground |
| `@accent_color` | Accent color |
| `@borders` | Border color |
| `@warning_color` | Warning indicator |
| `@error_color` | Error indicator |
| `@success_color` | Success indicator |

### System Style Classes

GTK provides built-in style classes. Mix them with custom styles using `cx`:

```tsx
import { css, cx } from "@gtkx/css";

const customPadding = css`
  padding: 16px;
`;

// Combine custom style with GTK's "suggested-action" class
<Button cssClasses={[cx(customPadding, "suggested-action")]} label="Primary" />

// Use system classes directly
<Button cssClasses={["destructive-action"]} label="Delete" />
<Box cssClasses={["card"]} />
<Label.Root cssClasses={["title-1"]} label="Large Title" />
```

Common GTK style classes:

| Class | Description |
|-------|-------------|
| `suggested-action` | Primary/suggested action button |
| `destructive-action` | Destructive action button |
| `flat` | Flat button style |
| `card` | Card-like container |
| `title-1` through `title-4` | Title text sizes |
| `heading` | Heading text |
| `body` | Body text |
| `caption` | Caption/small text |
| `monospace` | Monospace font |
| `dim-label` | Dimmed label |
| `accent` | Accent colored text |
| `success`, `warning`, `error` | Semantic colors |

## Complete Example

```tsx
import { css, cx, injectGlobal, keyframes } from "@gtkx/css";
import * as Gtk from "@gtkx/ffi/gtk";
import { useState } from "react";
import { ApplicationWindow, Box, Button, Label, quit, render } from "@gtkx/react";

// Global styles
injectGlobal`
  window {
    background: linear-gradient(180deg, @theme_bg_color, shade(@theme_bg_color, 0.9));
  }
`;

// Keyframe animation
const bounce = keyframes`
  0%, 100% { transform: translateY(0); }
  50% { transform: translateY(-10px); }
`;

// Component styles
const containerStyle = css`
  padding: 24px;
`;

const titleStyle = css`
  font-size: 32px;
  font-weight: bold;
  margin-bottom: 16px;
`;

const buttonBase = css`
  padding: 12px 24px;
  border-radius: 8px;
  transition: all 200ms ease;
`;

const buttonActive = css`
  animation: ${bounce} 0.5s ease;
`;

function App() {
  const [active, setActive] = useState(false);

  return (
    <ApplicationWindow
      title="Styled GTKX App"
      defaultWidth={400}
      defaultHeight={300}
      onCloseRequest={quit}
    >
      <Box
        cssClasses={[containerStyle]}
        orientation={Gtk.Orientation.VERTICAL}
        valign={Gtk.Align.CENTER}
        halign={Gtk.Align.CENTER}
        spacing={12}
      >
        <Label.Root cssClasses={[titleStyle]} label="Welcome" />

        <Button
          cssClasses={[cx(buttonBase, active && buttonActive)]}
          label={active ? "Active!" : "Click me"}
          onClicked={() => setActive(a => !a)}
        />

        <Button
          cssClasses={["suggested-action"]}
          label="System Style"
        />
      </Box>
    </ApplicationWindow>
  );
}

render(<App />, "com.example.styled");
```

## Supported CSS Properties

GTK CSS supports a subset of web CSS properties. Key supported properties include:

**Layout & Spacing:**
- `margin`, `margin-top`, `margin-bottom`, `margin-start`, `margin-end`
- `padding`, `padding-top`, `padding-bottom`, `padding-start`, `padding-end`
- `min-width`, `min-height`

**Colors & Backgrounds:**
- `color`, `background`, `background-color`
- `border-color`, `outline-color`
- `opacity`

**Borders:**
- `border`, `border-width`, `border-style`, `border-color`
- `border-radius`
- `outline`, `outline-width`, `outline-style`

**Typography:**
- `font-family`, `font-size`, `font-weight`, `font-style`
- `text-decoration`, `text-shadow`
- `letter-spacing`

**Effects:**
- `box-shadow`
- `transition`
- `animation`

**GTK-Specific:**
- `background-image` with GTK patterns
- `-gtk-icon-style`, `-gtk-icon-size`
- `caret-color`

For the complete reference, see the [GTK CSS documentation](https://docs.gtk.org/gtk4/css-properties.html).

# Styling

GTKX provides a CSS-in-JS styling system through the `@gtkx/css` package, built on top of [Emotion](https://emotion.sh/).

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

<GtkButton cssClasses={[buttonStyle]} label="Styled Button" />;
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

## Variable interpolation

You can interpolate variables and props, like you would with Emotion:

```tsx
const MyComponent = ({ isActive }: { isActive: boolean }) => {
    return (
        <GtkButton
            cssClasses={[
                css`
                    background: ${isActive ? "#3584e4" : "#ccc"};
                `,
            ]}
            label="Dynamic Style"
        />
    );
};
```

### Global application styles

For global styles, you can either use `injectGlobal` directly, or import a separate CSS file. The GTKX Vite plugin will take care of calling `injectGlobal` for you behind the scenes.

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

Or import from a CSS file:

```tsx
import "./styles/global.css";
```

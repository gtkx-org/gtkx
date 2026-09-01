---
title: "Animations"
description: "Animate native widget props and GTK CSS with React Spring."
---

# Animations

`@gtkx/animated` is the React Spring target for GTKX.

```bash
npm install @gtkx/animated
```

## Animate a widget

Wrap the component once at module scope, then pass values returned by React Spring hooks:

```tsx
import { animated, useSpring } from "@gtkx/animated";
import { GtkLabel } from "@gtkx/jsx/gtk";

const AnimatedLabel = animated(GtkLabel);

const FadeIn = () => {
    const styles = useSpring({ from: { opacity: 0 }, to: { opacity: 1 } });
    return <AnimatedLabel opacity={styles.opacity} label="Hello" />;
};
```

GObject properties are written directly through the widget ref each frame, without rerendering the component. Whole-number values are truncated and bounded properties are clamped. GTK margins cannot be negative; use a size, transform, or positive margin when sliding content.

The `style` prop also accepts springs, either as the whole object or individual declarations:

```tsx
const { level } = useSpring({ level: isOverdue ? 1 : 0 });

<AnimatedLabel
    label="Due today"
    style={level.to((value) => ({
        color: `mix(var(--window-fg-color), var(--error-color), ${value})`,
    }))}
/>;
```

GTK positions widgets through containers rather than CSS layout. Animate widget properties, a layout child's transform, or a CSS `transform` depending on which layer owns the position.

## Use the upstream model

`useTransition`, `useTrail`, `useSprings`, `useChain`, controllers, configs, and interpolations follow [React Spring](https://www.react-spring.dev/docs) semantics. DOM-only hooks such as `useScroll`, `useResize`, and `useInView` are not exported. The [GTKX reference](/reference/@gtkx/animated/) lists the available surface.

Animations use GTK's frame clock. When GTK animations are disabled, springs jump to their targets. `useReducedMotion()` also observes the desktop preference. Tests disable animations by default; opt in only when motion itself is observable behavior.

---
title: "Cairo"
description: "Use GTKX Cairo values in drawing callbacks and render images offscreen."
---

# Cairo

`@gtkx/cairo` provides the drawing objects used by GTKX's native bindings. Install it alongside the rest of your app:

```bash
npm install @gtkx/cairo
```

This guide covers the GTKX integration. For drawing techniques, use the [Cairo manual](https://www.cairographics.org/manual/); for available methods and types, see the [GTKX Cairo reference](/reference/@gtkx/cairo/).

## Draw in a widget

Add a `GtkDrawingArea` inside your application's JSX tree. Its `drawFunc` receives a managed Cairo context and the widget's current dimensions:

```tsx
import { GtkDrawingArea } from "@gtkx/jsx/gtk";

const Circle = () => (
    <GtkDrawingArea
        contentWidth={200}
        contentHeight={120}
        drawFunc={(_area, cr, width, height) => {
            cr.setSourceRgb(0.2, 0.4, 0.9);
            cr.arc(width / 2, height / 2, Math.min(width, height) / 3, 0, 2 * Math.PI);
            cr.fill();
        }}
    />
);
```

Draw only inside this callback: do not update widget properties or React state from it. Keep the context local to the callback. GTKX manages its native reference.

Changing `drawFunc` queues a repaint, including when a render supplies a new callback. If drawing data changes without replacing the callback, call `queueDraw()` on the area obtained through its `ref`. Use the callback's dimensions when drawing; `contentWidth` and `contentHeight` request a size, which can differ from the allocated space.

## Share values with native libraries

GTK and PangoCairo return the same managed classes that you import from `@gtkx/cairo`. Pass these objects directly between APIs. For example, `PangoCairo.createLayout(cr)` accepts the context from `drawFunc` without conversion.

Use PangoCairo for application text. Its [layout documentation](https://docs.gtk.org/PangoCairo/) covers shaping, font fallback and layout; import its bindings from `@gtkx/gi/pangocairo`.

Values returned by native libraries use their concrete wrapper classes. Check `surface instanceof ImageSurface` before reading image pixels from a surface returned by `cr.getTarget()`.

## Render offscreen

An `ImageSurface` lets you draw without a widget. Create a context for it, then save the result:

```ts
import { Context, Format, ImageSurface, Status, statusToString } from "@gtkx/cairo";

const surface = new ImageSurface(Format.ARGB32, 256, 256);
const cr = Context.create(surface);
cr.setSourceRgb(0.9, 0.3, 0.2);
cr.paint();

const status = surface.writeToPng("image.png");
if (status !== Status.SUCCESS) throw new Error(statusToString(status));
```

`getData()` returns a copy of the image's pixels, including row padding. Editing that array does not change the surface; draw through its context to update it. Load a saved image with `ImageSurface.createFromPng(path)`.

## Handle errors

Creating an image with an invalid size or loading a missing PNG throws.

Drawing operations retain Cairo's status model. Check `cr.status()` after drawing; operations that return a `Status`, such as `writeToPng`, need their return value checked directly. Use `statusToString` when presenting an error.

## The 1.x compatibility import

`@gtkx/gi/cairo` remains available in GTKX 1.6 as a deprecated re-export. New code should install and import `@gtkx/cairo`; the compatibility path is removed in 2.0.

## Next

Continue with [OpenGL](/guide/opengl) to draw with the GPU inside a widget.

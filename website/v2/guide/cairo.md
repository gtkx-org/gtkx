---
title: "Cairo"
description: "Use GTKX Cairo values in drawing callbacks and render images offscreen."
---

# Cairo

`@gtkx/cairo` provides the drawing objects used by GTKX's native bindings. Install it alongside the rest of your app:

```bash
npm install @gtkx/cairo@beta
```

This guide covers the GTKX integration. For drawing techniques, use the [Cairo manual](https://www.cairographics.org/manual/); for available methods and types, see the [GTKX Cairo reference](/v2/reference/@gtkx/cairo/).

## Draw in a widget

Add a `GtkDrawingArea` inside your application's JSX tree. Its `drawFunc` receives a managed Cairo context and the widget's current dimensions:

<<< @/figures/guide/cairo-circle.tsx

<figure class="result">
    <img class="result-light" src="/figures/guide-cairo-circle-light.png" width="360" height="260" loading="lazy" alt="A window titled Cairo filled by a drawing area with a blue circle at its center." />
    <img class="result-dark" src="/figures/guide-cairo-circle-dark.png" width="360" height="260" loading="lazy" alt="A window titled Cairo filled by a drawing area with a blue circle at its center." />
    <figcaption>Captured from the sample above. The area fills the window, so the circle follows the callback's <code>width</code> and <code>height</code> rather than the requested 200 × 120.</figcaption>
</figure>

Draw only inside this callback: do not update widget properties or React state from it. Keep the context local to the callback. GTKX releases it when the callback returns, so the callback does not need to call `cr.$dispose()`. Code ported from GJS that does call it keeps working; any drawing through the context after that call throws.

Changing `drawFunc` queues a repaint, including when a render supplies a new callback. If drawing data changes without replacing the callback, call `queueDraw()` on the area obtained through its `ref`. Use the callback's dimensions when drawing; `contentWidth` and `contentHeight` request a size, which can differ from the allocated space.

## Share values with native libraries

GTK and PangoCairo return the same managed classes that you import from `@gtkx/cairo`. Pass these objects directly between APIs. For example, `PangoCairo.showLayout(cr, layout)` accepts the context from `drawFunc` without conversion.

Use Pango for application text. Inside `drawFunc`, create the layout with the widget's `createPangoLayout(text)`, which uses the widget's font, and draw it with PangoCairo:

```tsx
import * as PangoCairo from "@gtkx/gi/pangocairo";
import { GtkDrawingArea } from "@gtkx/jsx/gtk";

const Caption = () => (
    <GtkDrawingArea
        contentWidth={200}
        contentHeight={40}
        drawFunc={(area, cr) => {
            const layout = area.createPangoLayout("Mood this week");
            cr.moveTo(8, 8);
            PangoCairo.showLayout(cr, layout);
        }}
    />
);
```

`PangoCairo.createLayout(cr)` creates a layout with Pango's default font rather than the widget's, so text drawn with it does not match the rest of the interface. Use it for offscreen rendering, and set a font with `layout.setFontDescription()`; `widget.getPangoContext().getFontDescription()` returns the font a widget uses. The [PangoCairo documentation](https://docs.gtk.org/PangoCairo/) covers shaping, font fallback and layout; import its bindings from `@gtkx/gi/pangocairo`.

`cr.copyPath()` and `cr.copyPathFlat()` return a `Path`, which `cr.appendPath()` and bindings such as `Gsk.PathBuilder.addCairoPath()` accept as is. This turns text into a `GskPath`, for example:

```ts
import * as Gsk from "@gtkx/gi/gsk";
import * as PangoCairo from "@gtkx/gi/pangocairo";

PangoCairo.layoutPath(cr, layout);
const builder = Gsk.PathBuilder.new();
builder.addCairoPath(cr.copyPathFlat());
const textPath = builder.toPath();
```

Call `path.toData()` to read a path's segments.

Values returned by native libraries use their concrete wrapper classes. Check `surface instanceof ImageSurface` before reading image pixels from a surface returned by `cr.getTarget()`.

## Render offscreen

An `ImageSurface` lets you draw without a widget. Create a context for it, then save the result:

```ts
import { Context, Format, ImageSurface, Status, statusToString } from "@gtkx/cairo";

const surface = new ImageSurface(Format.ARGB32, 256, 256);
const cr = Context.create(surface);
cr.setSourceRgb(0.9, 0.3, 0.2);
cr.paint();
cr.$dispose();

const status = surface.writeToPng("image.png");
if (status !== Status.SUCCESS) throw new Error(statusToString(status));
```

`getData()` returns a copy of the image's pixels, including row padding. Editing that array does not change the surface; draw through its context to update it. Load a saved image with `ImageSurface.createFromPng(path)`.

## Release contexts you create

A context obtained outside a draw callback holds its target surface until JavaScript garbage-collects it. This applies to the contexts from `Context.create(surface)` and from `snapshot.appendCairo(bounds)` in a widget's `vfuncSnapshot`, as well as those returned by other native calls. Call `cr.$dispose()` when you finish drawing, as C calls `cairo_destroy` and GJS calls `$dispose()`; the offscreen example above does.

Releasing them matters most for contexts created on every frame. A snapshot context records the frame, and Cairo copies a backing surface into each recording that still holds it when the app draws into that surface again. Without `$dispose()`, a widget that paints a canvas it keeps updating can grow to gigabytes before the garbage collector runs. [Subclassing](/v2/guide/subclassing#draw-with-cairo-in-vfuncsnapshot) shows the pattern.

After `$dispose()`, every call on the context throws. Calling `$dispose()` again does nothing. If a native call is still drawing with the context, for example when `$dispose()` runs in a callback that call invoked, `$dispose()` throws and leaves the context usable.

## Handle errors

Creating an image with an invalid size or loading a missing PNG throws. Queries that cannot return a value also throw: for example, reading gradient stops from a solid pattern or requesting rectangles for a circular clip. Reading pixels from a finished surface throws too.

Drawing operations retain Cairo's status model. Check `cr.status()` after drawing; operations that return a `Status`, such as `writeToPng`, need their return value checked directly. Use `statusToString` when presenting an error.

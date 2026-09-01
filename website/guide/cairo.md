---
title: "Cairo"
description: "Draw 2D graphics in a GtkDrawingArea or an offscreen surface."
---

# Cairo

`@gtkx/cairo` provides managed TypeScript wrappers for cairo contexts, surfaces, patterns, paths, and fonts.

```bash
npm install @gtkx/cairo
```

## Draw in a widget

`GtkDrawingArea` passes a clipped context and its current size to `drawFunc`:

```tsx
import { type Context, Pattern } from "@gtkx/cairo";
import type * as Gtk from "@gtkx/gi/gtk";
import { GtkDrawingArea } from "@gtkx/jsx/gtk";

const draw = (_area: Gtk.DrawingArea, cr: Context, _width: number, height: number) => {
    const gradient = Pattern.createLinear(0, 0, 0, height);
    gradient.addColorStopRgb(0, 0.2, 0.4, 0.9);
    gradient.addColorStopRgb(1, 0.1, 0.1, 0.3);
    cr.setSource(gradient);
    cr.paint();
};

const Canvas = () => <GtkDrawingArea contentWidth={200} contentHeight={100} drawFunc={draw} />;
```

The callback owns the context only while it runs. Do not store it in state or a ref. React rerenders do not repaint the area; call `queueDraw()` after scene data changes.

Factories and constructors throw when cairo cannot create a value. Existing objects report later failures through `status()`. Use PangoCairo with the same context for shaping, fallback, wrapping, or rich text.

## Draw offscreen

```ts
import { Context, Format, ImageSurface, Status } from "@gtkx/cairo";

const surface = new ImageSurface(Format.ARGB32, 256, 256);
const cr = Context.create(surface);
cr.setSourceRgb(0.9, 0.3, 0.2);
cr.paint();

if (surface.writeToPng("image.png") !== Status.SUCCESS) throw new Error();
```

`getData()` returns a copy of the pixel bytes. Draw through a context instead of holding borrowed mapped images. The [cairo reference](/reference/@gtkx/cairo/) covers supported wrappers and intentionally omitted ownership-sensitive calls.

---
title: "Cairo"
description: "Draw 2D graphics in a GTKX app using @gtkx/cairo: contexts, surfaces, patterns, and fonts behind the GtkDrawingArea draw callback, plus offscreen rendering to PNG."
---

# Cairo

`@gtkx/cairo` draws 2D graphics from TypeScript: paths, gradients, text, and offscreen surfaces, against the `cairo.Context` that GTK hands every draw callback. It installs separately:

```bash
npm install @gtkx/cairo
```

## What the package contains

The cairo drawing model, behind named imports:

```ts
import { Context, Format, ImageSurface, Pattern, Status } from "@gtkx/cairo";
```

`Context` is the drawing context every operation goes through. `Surface` is what a context draws onto, with `ImageSurface` (pixels in memory) and `RecordingSurface` (replayable operations) as its concrete kinds. `Pattern` is what a context draws *with*: `createRgb` for solid colors, `createLinear` and `createRadial` for gradients, `createMesh` for mesh gradients. `FontFace`, `ScaledFont`, and `FontOptions` select and configure text rendering; `Matrix`, `Region`, and `Path` round out the geometry types.

`Surface`, `Pattern`, and `FontFace` are abstract: instances come from their `create*` statics, from a concrete subclass constructor such as `new ImageSurface(...)`, or from GTK. Whatever the source, an instance arrives as its concrete class, so `surface instanceof ImageSurface` narrows a surface GTK handed you, and `ctx.getSource() instanceof LinearPattern` holds after `ctx.setSource(Pattern.createLinear(...))`.

Constructors and `create*` factories throw when cairo reports an error, so an invalid size or a missing file never yields a broken object. On an existing object, operations report failure through a status instead of throwing: `ctx.status()`, `surface.status()`, and `pattern.status()` return a `Status`, and `statusToString(status)` describes it. The [@gtkx/cairo reference](/reference/@gtkx/cairo/) lists every class, enum, and type.

## The GtkDrawingArea draw callback

`GtkDrawingArea` is the widget you draw into. Its `drawFunc` prop runs whenever the widget paints, receiving the area, a `Context` already clipped to the widget, and the current width and height:

```tsx
import { Context, FontSlant, FontWeight, Pattern } from "@gtkx/cairo";
import type * as Gtk from "@gtkx/gi/gtk";
import { GtkDrawingArea } from "@gtkx/jsx/gtk";

const drawGradient = (area: Gtk.DrawingArea, cr: Context, width: number, height: number) => {
    const gradient = Pattern.createLinear(0, 0, 0, height);
    gradient.addColorStopRgb(0, 0.2, 0.4, 0.9);
    gradient.addColorStopRgb(1, 0.1, 0.1, 0.3);
    cr.setSource(gradient);
    cr.paint();

    cr.setSourceRgb(1, 1, 1);
    cr.selectFontFace("Sans", FontSlant.NORMAL, FontWeight.BOLD);
    cr.setFontSize(24);
    cr.moveTo(12, height / 2);
    cr.showText(`${width} × ${height}`);
};

const GradientCard = () => <GtkDrawingArea contentWidth={200} contentHeight={100} drawFunc={drawGradient} />;
```

The context only lives for the duration of the callback, so do not keep it in a ref or state. A re-render does not repaint the area; `area.queueDraw()` does, so a control that changes the scene sets its state and queues a draw. `onResize` fires with the new viewport size when the area changes size, and the next draw receives the updated width and height.

## Offscreen rendering

An `ImageSurface` draws without a widget: construct one, point a `Context` at it, and write the result to a PNG:

```ts
import { Context, Format, ImageSurface, Status, statusToString } from "@gtkx/cairo";

const surface = new ImageSurface(Format.ARGB32, 256, 256);
const cr = Context.create(surface);
cr.setSourceRgb(0.9, 0.3, 0.2);
cr.arc(128, 128, 96, 0, 2 * Math.PI);
cr.fill();

const status = surface.writeToPng("circle.png");
if (status !== Status.SUCCESS) throw new Error(statusToString(status));
```

`surface.getData()` returns the raw pixel buffer as a `Uint8Array` for inspection, and `ImageSurface.createFromPng(path)` loads one back, throwing if the file is missing or not a PNG.

## The deprecated `@gtkx/gi/cairo` alias

Before GTKX 1.3, the cairo binding was generated into the binding store as `@gtkx/gi/cairo`. That subpath remains for all of 1.x as a re-export of `@gtkx/cairo`, so existing imports keep working unchanged, but it is deprecated and removed in 2.0.

New projects scaffolded by `create-gtkx` already depend on `@gtkx/cairo`. An existing project should add it to its dependencies; until it does, codegen links the copy `@gtkx/codegen` ships into the generated store and prints a one-line warning on every run.

## Next

Continue with [OpenGL](/guide/opengl) to draw with the GPU inside a widget.

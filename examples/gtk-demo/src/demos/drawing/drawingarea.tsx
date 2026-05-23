import { Content, Context, Format, ImageSurface, LineCap, Operator, Surface } from "@gtkx/ffi/cairo";
import * as Gtk from "@gtkx/ffi/gtk";
import { GtkBox, GtkDrawingArea, GtkFrame, GtkGestureDrag, GtkLabel } from "@gtkx/react";
import { useCallback, useRef, useState } from "react";
import type { Demo } from "../types.js";
import sourceCode from "./drawingarea.tsx?raw";

const CHECK_SIZE = 16;

const ovalPath = (cr: Context, { xc, yc, xr, yr }: { xc: number; yc: number; xr: number; yr: number }) => {
    cr.save();
    cr.translate(xc, yc);
    cr.scale(1, yr / xr);
    cr.moveTo(xr, 0);
    cr.arc({ xc: 0, yc: 0, radius: xr, angle1: 0, angle2: 2 * Math.PI });
    cr.closePath();
    cr.restore();
};

const fillChecks = (cr: Context, { x, y, width, height }: { x: number; y: number; width: number; height: number }) => {
    cr.rectangle(x, y, width, height);
    cr.setSourceRgb(0.4, 0.4, 0.4);
    cr.fill();

    let j = y & ~(CHECK_SIZE - 1);
    while (j < y + height) {
        let i = x & ~(CHECK_SIZE - 1);
        while (i < x + width) {
            if ((Math.floor(i / CHECK_SIZE) + Math.floor(j / CHECK_SIZE)) % 2 === 0) {
                cr.rectangle(i, j, CHECK_SIZE, CHECK_SIZE);
            }
            i += CHECK_SIZE;
        }
        j += CHECK_SIZE;
    }
    cr.setSourceRgb(0.7, 0.7, 0.7);
    cr.fill();
};

const draw3Circles = (
    cr: Context,
    { xc, yc, radius, alpha }: { xc: number; yc: number; radius: number; alpha: number },
) => {
    const subradius = radius * (2 / 3 - 0.1);

    cr.setSourceRgba(1, 0, 0, alpha);
    ovalPath(cr, {
        xc: xc + (radius / 3) * Math.cos(Math.PI * 0.5),
        yc: yc - (radius / 3) * Math.sin(Math.PI * 0.5),
        xr: subradius,
        yr: subradius,
    });
    cr.fill();

    cr.setSourceRgba(0, 1, 0, alpha);
    ovalPath(cr, {
        xc: xc + (radius / 3) * Math.cos(Math.PI * (0.5 + 2 / 0.3)),
        yc: yc - (radius / 3) * Math.sin(Math.PI * (0.5 + 2 / 0.3)),
        xr: subradius,
        yr: subradius,
    });
    cr.fill();

    cr.setSourceRgba(0, 0, 1, alpha);
    ovalPath(cr, {
        xc: xc + (radius / 3) * Math.cos(Math.PI * (0.5 + 4 / 0.3)),
        yc: yc - (radius / 3) * Math.sin(Math.PI * (0.5 + 4 / 0.3)),
        xr: subradius,
        yr: subradius,
    });
    cr.fill();
};

const drawKnockoutGroups = (cr: Context, width: number, height: number) => {
    const radius = 0.5 * Math.min(width, height) - 10;
    const xc = width / 2;
    const yc = height / 2;

    fillChecks(cr, { x: 0, y: 0, width, height });

    const overlay = Surface.createSimilar(cr.getTarget(), Content.COLOR_ALPHA, width, height);
    const punch = Surface.createSimilar(cr.getTarget(), Content.ALPHA, width, height);
    const circles = Surface.createSimilar(cr.getTarget(), Content.COLOR_ALPHA, width, height);

    const overlayCr = Context.create(overlay);
    overlayCr.setSourceRgb(0, 0, 0);
    ovalPath(overlayCr, { xc, yc, xr: radius, yr: radius });
    overlayCr.fill();

    const punchCr = Context.create(punch);
    draw3Circles(punchCr, { xc, yc, radius, alpha: 1 });

    overlayCr.setOperator(Operator.DEST_OUT);
    overlayCr.setSourceSurface(punch, 0, 0);
    overlayCr.paint();

    const circlesCr = Context.create(circles);
    circlesCr.setOperator(Operator.OVER);
    draw3Circles(circlesCr, { xc, yc, radius, alpha: 0.5 });

    overlayCr.setOperator(Operator.ADD);
    overlayCr.setSourceSurface(circles, 0, 0);
    overlayCr.paint();

    cr.setSourceSurface(overlay, 0, 0);
    cr.paint();
};

const createSurface = (width: number, height: number): ImageSurface => {
    const surface = ImageSurface.create(Format.ARGB32, width, height);
    const cr = Context.create(surface);
    cr.setSourceRgb(1, 1, 1);
    cr.paint();
    return surface;
};

const drawBrush = (surface: ImageSurface, widget: Gtk.DrawingArea, x: number, y: number) => {
    const cr = Context.create(surface);
    cr.moveTo(x, y);
    cr.lineTo(x, y);
    cr.setLineWidth(6);
    cr.setLineCap(LineCap.ROUND);
    cr.setSourceRgb(0, 0, 0);
    cr.stroke();
    widget.queueDraw();
};

function useScribbleHandlers(
    ref: React.RefObject<Gtk.DrawingArea | null>,
    surfaceRef: React.RefObject<ImageSurface | null>,
    startPointRef: React.RefObject<{ x: number; y: number }>,
) {
    const handleDragBegin = useCallback(
        (startX: number, startY: number) => {
            startPointRef.current = { x: startX, y: startY };
            if (surfaceRef.current && ref.current) {
                drawBrush(surfaceRef.current, ref.current, startX, startY);
            }
        },
        [ref, surfaceRef, startPointRef],
    );

    const handleDragOffset = useCallback(
        (offsetX: number, offsetY: number) => {
            if (surfaceRef.current && ref.current) {
                drawBrush(
                    surfaceRef.current,
                    ref.current,
                    startPointRef.current.x + offsetX,
                    startPointRef.current.y + offsetY,
                );
            }
        },
        [ref, surfaceRef, startPointRef],
    );

    return { handleDragBegin, handleDragUpdate: handleDragOffset, handleDragEnd: handleDragOffset };
}

const ScribbleArea = ({ accessibleLabelledBy }: { accessibleLabelledBy?: Gtk.Widget[] }) => {
    const ref = useRef<Gtk.DrawingArea | null>(null);
    const surfaceRef = useRef<ImageSurface | null>(null);
    const startPointRef = useRef({ x: 0, y: 0 });

    const handleResize = useCallback((width: number, height: number) => {
        surfaceRef.current = createSurface(width, height);
    }, []);

    const drawScribble = useCallback((cr: Context) => {
        if (surfaceRef.current) {
            cr.setSourceSurface(surfaceRef.current, 0, 0);
            cr.paint();
        }
    }, []);

    const { handleDragBegin, handleDragUpdate, handleDragEnd } = useScribbleHandlers(ref, surfaceRef, startPointRef);

    return (
        <GtkDrawingArea
            name="scribble-area"
            ref={ref}
            contentWidth={100}
            contentHeight={100}
            render={drawScribble}
            onResize={handleResize}
            accessibleRole={Gtk.AccessibleRole.IMG}
            accessibleLabelledBy={accessibleLabelledBy}
        >
            <GtkGestureDrag
                button={0}
                onDragBegin={handleDragBegin}
                onDragUpdate={handleDragUpdate}
                onDragEnd={handleDragEnd}
            />
        </GtkDrawingArea>
    );
};

const DrawingAreaDemo = () => {
    const [knockoutLabel, setKnockoutLabel] = useState<Gtk.Label | null>(null);
    const [scribbleLabel, setScribbleLabel] = useState<Gtk.Label | null>(null);

    return (
        <GtkBox
            orientation={Gtk.Orientation.VERTICAL}
            spacing={8}
            marginStart={16}
            marginEnd={16}
            marginTop={16}
            marginBottom={16}
        >
            <GtkLabel ref={setKnockoutLabel} label="Knockout groups" cssClasses={["heading"]} />
            <GtkFrame vexpand>
                <GtkDrawingArea
                    name="knockout-area"
                    render={drawKnockoutGroups}
                    contentWidth={100}
                    contentHeight={100}
                    accessibleRole={Gtk.AccessibleRole.IMG}
                    accessibleLabelledBy={knockoutLabel ? [knockoutLabel] : undefined}
                />
            </GtkFrame>

            <GtkLabel ref={setScribbleLabel} label="Scribble area" cssClasses={["heading"]} />
            <GtkFrame vexpand>
                <ScribbleArea accessibleLabelledBy={scribbleLabel ? [scribbleLabel] : undefined} />
            </GtkFrame>
        </GtkBox>
    );
};

export const drawingAreaDemo: Demo = {
    id: "drawingarea",
    title: "Drawing Area",
    description:
        'GtkDrawingArea is a blank area where you can draw custom displays of various kinds.\n\nThis demo has two drawing areas. The checkerboard area shows how you can just draw something; all you have to do is set a function via gtk_drawing_area_set_draw_func(), as shown here.\n\nThe "scribble" area is a bit more advanced, and shows how to handle events such as button presses and mouse motion. Click the mouse and drag in the scribble area to draw squiggles. Resize the window to clear the area.',
    keywords: ["GtkDrawingArea"],
    component: DrawingAreaDemo,
    sourceCode,
    defaultWidth: 250,
};

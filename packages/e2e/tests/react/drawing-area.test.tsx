import type * as Gtk from "@gtkx/gi/gtk";
import { Context, ImageSurface, RecordingSurface, Status, Surface, SurfaceType } from "@gtkx/cairo";
import { GtkDrawingArea } from "@gtkx/jsx/gtk";
import { render, waitFor } from "@gtkx/testing";
import { describe, expect, it } from "vitest";

type SurfaceClass = abstract new (...args: never[]) => Surface;
type Frame = { cr: Context; width: number; height: number; status: Status; target: Surface; targetType: SurfaceType };

const FRAME_SIZE = 8;

const CONCRETE_SURFACE_CLASSES: Partial<Record<SurfaceType, SurfaceClass>> = {
    [SurfaceType.IMAGE]: ImageSurface,
    [SurfaceType.RECORDING]: RecordingSurface,
};

const captureFrame = (cr: Context, width: number, height: number): Frame => {
    cr.setSourceRgb(1, 0, 0);
    cr.paint();
    const target = cr.getTarget();

    return { cr, width, height, status: cr.status(), target, targetType: target.getType() };
};

const drawOnce = async (): Promise<Frame> => {
    const captured: { current: Frame | null } = { current: null };

    await render(
        <GtkDrawingArea
            contentWidth={FRAME_SIZE}
            contentHeight={FRAME_SIZE}
            drawFunc={(_area, cr, width, height) => {
                captured.current ??= captureFrame(cr, width, height);
            }}
        />,
    );

    await waitFor(() => {
        expect(captured.current).not.toBeNull();
    });

    if (captured.current === null) {
        throw new Error("expected the drawing area to have drawn");
    }

    return captured.current;
};

describe("a drawing area rendered from React", () => {
    it("hands the draw callback a Context whose target wraps as its concrete surface class", async () => {
        const frame = await drawOnce();
        expect(frame.cr).toBeInstanceOf(Context);
        expect(frame.status).toBe(Status.SUCCESS);
        expect(frame.width).toBeGreaterThanOrEqual(FRAME_SIZE);
        expect(frame.height).toBeGreaterThanOrEqual(FRAME_SIZE);
        expect(frame.target).toBeInstanceOf(Surface);
        expect(frame.target).toBeInstanceOf(CONCRETE_SURFACE_CLASSES[frame.targetType] ?? Surface);
    });

    it("draws again with a Context after queueDraw", async () => {
        const frames: Frame[] = [];
        const areaRef: { current: Gtk.DrawingArea | null } = { current: null };

        await render(
            <GtkDrawingArea
                contentWidth={FRAME_SIZE}
                contentHeight={FRAME_SIZE}
                drawFunc={(area, cr, width, height) => {
                    areaRef.current = area;
                    frames.push(captureFrame(cr, width, height));
                }}
            />,
        );

        await waitFor(() => {
            expect(frames.length).toBeGreaterThanOrEqual(1);
        });

        const drawnFrames = frames.length;
        areaRef.current?.queueDraw();

        await waitFor(() => {
            expect(frames.length).toBeGreaterThan(drawnFrames);
        });

        expect(frames.at(-1)?.cr).toBeInstanceOf(Context);
    });
});

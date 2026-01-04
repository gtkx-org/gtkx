import { createRef } from "@gtkx/ffi";
import * as Gsk from "@gtkx/ffi/gsk";
import * as Gtk from "@gtkx/ffi/gtk";
import { tick } from "./timing.js";
import type { ScreenshotResult, WaitForOptions } from "./types.js";
import { waitFor } from "./wait-for.js";

const bytesToBase64 = (bytes: number[]): string => {
    return Buffer.from(bytes).toString("base64");
};

const DEFAULT_SCREENSHOT_TIMEOUT = 100;
const DEFAULT_SCREENSHOT_INTERVAL = 10;

const captureSnapshot = (widget: Gtk.Widget): ScreenshotResult => {
    const paintable = new Gtk.WidgetPaintable(widget);
    const width = paintable.getIntrinsicWidth();
    const height = paintable.getIntrinsicHeight();

    if (width <= 0 || height <= 0) {
        throw new Error("Widget has no size - ensure it is realized and visible");
    }

    const snapshot = new Gtk.Snapshot();
    paintable.snapshot(snapshot, width, height);
    const renderNode = snapshot.toNode();

    if (!renderNode) {
        throw new Error("Widget produced no render content");
    }

    const display = widget.getDisplay();
    if (!display) {
        throw new Error("Widget has no display - ensure it is realized");
    }

    const renderer = new Gsk.CairoRenderer();
    renderer.realizeForDisplay(display);

    try {
        const texture = renderer.renderTexture(renderNode);
        const pngBytes = texture.saveToPngBytes();
        const sizeRef = createRef(0);
        const data = pngBytes.getData(sizeRef);

        if (!data) {
            throw new Error("Failed to serialize screenshot to PNG");
        }

        return {
            data: bytesToBase64(data),
            mimeType: "image/png",
            width,
            height,
        };
    } finally {
        renderer.unrealize();
    }
};

export type ScreenshotOptions = Pick<WaitForOptions, "timeout" | "interval">;

/**
 * Captures a screenshot of a GTK widget as a PNG image.
 *
 * This function will retry multiple times if the widget hasn't finished
 * rendering, waiting for GTK to complete its paint cycle.
 *
 * @param widget - The widget to capture (typically a Window)
 * @param options - Optional timeout and interval configuration
 * @returns Screenshot result containing base64-encoded PNG data and dimensions
 * @throws Error if widget has no size, is not realized, or rendering fails after timeout
 *
 * @example
 * ```tsx
 * import { render, screenshot } from "@gtkx/testing";
 * import * as Gtk from "@gtkx/ffi/gtk";
 *
 * const { container } = await render(<MyApp />);
 * const window = container.getWindows()[0];
 * const result = await screenshot(window);
 * console.log(result.mimeType); // "image/png"
 * ```
 */
export const screenshot = async (widget: Gtk.Widget, options?: ScreenshotOptions): Promise<ScreenshotResult> => {
    await tick();

    return waitFor(() => captureSnapshot(widget), {
        timeout: options?.timeout ?? DEFAULT_SCREENSHOT_TIMEOUT,
        interval: options?.interval ?? DEFAULT_SCREENSHOT_INTERVAL,
        onTimeout: (error) => {
            const paintable = new Gtk.WidgetPaintable(widget);
            const width = paintable.getIntrinsicWidth();
            const height = paintable.getIntrinsicHeight();

            if (width <= 0 || height <= 0) {
                return new Error("Widget has no size - ensure it is realized and visible");
            }
            return new Error(`Widget produced no render content after waiting for paint cycle. ${error.message}`);
        },
    });
};

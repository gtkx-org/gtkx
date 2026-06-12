import * as Gsk from "@gtkx/gi/gsk";
import * as Gtk from "@gtkx/gi/gtk";
import type { ScreenshotResult, WaitForOptions } from "./types.js";
import { waitFor } from "./wait-for.js";

const bytesToBase64 = (bytes: number[]): string => {
    return Buffer.from(bytes).toString("base64");
};

const DEFAULT_SCREENSHOT_TIMEOUT = 100;
const DEFAULT_SCREENSHOT_INTERVAL = 10;

const describeWidgetState = (widget: Gtk.Widget): string =>
    `realized=${widget.getRealized()} mapped=${widget.getMapped()} visible=${widget.getVisible()}`;

const captureSnapshot = (widget: Gtk.Widget, scale: number): ScreenshotResult => {
    const paintable = new Gtk.WidgetPaintable({ widget });
    const width = paintable.getIntrinsicWidth();
    const height = paintable.getIntrinsicHeight();

    if (width <= 0 || height <= 0) {
        throw new Error(`Widget has no size: ensure it is realized and visible (${describeWidgetState(widget)})`);
    }

    const snapshot = new Gtk.Snapshot();
    snapshot.scale(scale, scale);
    paintable.snapshot(snapshot, width, height);
    const renderNode = snapshot.toNode();

    if (!renderNode) {
        throw new Error(`Widget produced no render content (${describeWidgetState(widget)})`);
    }

    const display = widget.getDisplay();
    if (!display) {
        throw new Error("Widget has no display: ensure it is realized");
    }

    const renderer = new Gsk.CairoRenderer();
    renderer.realizeForDisplay(display);

    try {
        const texture = renderer.renderTexture(renderNode, null);
        const pngBytes = texture.saveToPngBytes();
        const data = pngBytes.getData();

        if (!data) {
            throw new Error("Failed to serialize screenshot to PNG");
        }

        return {
            data: bytesToBase64(data),
            mimeType: "image/png",
            width: Math.round(width * scale),
            height: Math.round(height * scale),
        };
    } finally {
        renderer.unrealize();
    }
};

/**
 * Options for capturing widget screenshots.
 */
export type ScreenshotOptions = Pick<WaitForOptions, "timeout" | "interval"> & {
    /**
     * Supersampling factor applied while rasterizing the widget. The widget is
     * laid out at its logical size and painted at `scale` times that size, so
     * text and strokes render crisply in the enlarged output (e.g. `2` yields a
     * 2x-resolution capture suitable for high-DPI documentation imagery).
     * Defaults to `1`.
     */
    scale?: number;
};

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
 * import * as Gtk from "@gtkx/gi/gtk";
 *
 * const { container } = await render(<MyApp />);
 * const window = container.getWindows()[0];
 * const result = await screenshot(window);
 * console.log(result.mimeType); // "image/png"
 * ```
 */
export const screenshot = async (widget: Gtk.Widget, options?: ScreenshotOptions): Promise<ScreenshotResult> => {
    const scale = options?.scale ?? 1;

    if (!Number.isFinite(scale) || scale <= 0) {
        throw new Error(`Screenshot scale must be a positive number, got ${scale}`);
    }

    return waitFor(() => captureSnapshot(widget, scale), {
        timeout: options?.timeout ?? DEFAULT_SCREENSHOT_TIMEOUT,
        interval: options?.interval ?? DEFAULT_SCREENSHOT_INTERVAL,
        onTimeout: (error) => {
            const paintable = new Gtk.WidgetPaintable({ widget });
            const width = paintable.getIntrinsicWidth();
            const height = paintable.getIntrinsicHeight();

            if (width <= 0 || height <= 0) {
                return new Error("Widget has no size: ensure it is realized and visible");
            }
            return new Error(`Widget produced no render content after waiting for paint cycle: ${error.message}`);
        },
    });
};

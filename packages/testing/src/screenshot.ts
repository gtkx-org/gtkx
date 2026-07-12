import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import * as Gsk from "@gtkx/gi/gsk";
import * as Gtk from "@gtkx/gi/gtk";
import type { ScreenshotOptions, ScreenshotResult, WindowSelector } from "./types.js";
import { waitFor } from "./wait-for.js";

const bytesToBase64 = (bytes: number[]): string => {
    return Buffer.from(bytes).toString("base64");
};

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
 * Captures a PNG snapshot of a widget, retrying until it has a paintable size.
 *
 * @param widget The widget to render to an image.
 * @param options Optional scale, timeout, and retry interval.
 * @returns The base64-encoded PNG data along with its mime type and dimensions.
 */
export const screenshot = async (widget: Gtk.Widget, options?: ScreenshotOptions): Promise<ScreenshotResult> => {
    const scale = options?.scale ?? 1;

    if (!Number.isFinite(scale) || scale <= 0) {
        throw new Error(`Screenshot scale must be a positive number, got ${scale}`);
    }

    return waitFor(() => captureSnapshot(widget, scale), {
        timeout: options?.timeout,
        interval: options?.interval ?? DEFAULT_SCREENSHOT_INTERVAL,
    });
};

const resolveWindow = (selector?: WindowSelector): Gtk.Window => {
    const windows = Gtk.Window.listToplevels();

    if (windows.length === 0) {
        throw new Error("No windows available for screenshot");
    }

    if (selector === undefined) {
        const [first] = windows;
        if (!(first instanceof Gtk.Window)) {
            throw new TypeError("First toplevel is not a Window");
        }
        return first;
    }

    if (typeof selector === "number") {
        const indexed = windows[selector];
        if (!(indexed instanceof Gtk.Window)) {
            throw new TypeError(`Window at index ${selector} not found`);
        }
        return indexed;
    }

    const isRegex = selector instanceof RegExp;
    const found = windows.find((w): w is Gtk.Window => {
        if (!(w instanceof Gtk.Window)) return false;
        const title = w.getTitle() ?? "";
        return isRegex ? selector.test(title) : title.includes(selector);
    });

    if (!found) {
        const pattern = isRegex ? selector.toString() : `"${selector}"`;
        throw new Error(`No window found with title matching ${pattern}`);
    }
    return found;
};

const saveScreenshotToTempFile = (result: ScreenshotResult): string => {
    const dir = join(tmpdir(), "gtkx-screenshots");
    if (!existsSync(dir)) {
        mkdirSync(dir, { recursive: true });
    }
    const filepath = join(dir, `${Date.now()}-screenshot.png`);
    writeFileSync(filepath, Buffer.from(result.data, "base64"));
    return filepath;
};

/**
 * Prints a clickable file URL for a saved screenshot to the console.
 *
 * @param filepath Absolute path of the saved screenshot file.
 */
export const logScreenshotPath = (filepath: string): void => {
    console.log(`Screenshot saved: file://${filepath}`);
};

/**
 * Captures a screenshot of a toplevel window, writes it to a temporary file,
 * logs its path, and returns the image data.
 *
 * @param selector Chooses the window by index, title substring, or regular
 * expression; defaults to the first toplevel.
 * @param options Optional scale, timeout, and retry interval.
 * @returns The base64-encoded PNG data along with its mime type and dimensions.
 */
export const captureAndSaveScreenshot = async (
    selector?: WindowSelector,
    options?: ScreenshotOptions,
): Promise<ScreenshotResult> => {
    const target = resolveWindow(selector);
    const result = await screenshot(target, options);
    logScreenshotPath(saveScreenshotToTempFile(result));
    return result;
};

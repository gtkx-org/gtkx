import * as Gdk from "@gtkx/gi/gdk";
import * as Graphene from "@gtkx/gi/graphene";
import * as Gsk from "@gtkx/gi/gsk";
import * as Gtk from "@gtkx/gi/gtk";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { ScreenshotOptions, ScreenshotResult, WindowSelector } from "./types.js";
import { getConfig } from "./config.js";
import { descendants } from "./traversal.js";
import { waitFor } from "./wait-for.js";

/** The window's frame clock progress, used to tell a stalled display from an empty widget. */
type FrameProbe = {
    /** Baseline later readings are compared against, `null` until the window has a frame clock. */
    counter: bigint | null;
    /** Milliseconds timestamp of when the frame clock first reported a counter, which stalling is measured from. */
    startedAt: number;
};

/** Why a capture produced no image: the widget reported no size, or it painted nothing. */
type CaptureFailure = "no-size" | "no-content";

/** What a capture attempt observed, carried across retries so the failure can be explained. */
type CaptureState = {
    /** Frame clock progress for the whole capture, updated by every attempt. */
    probe: FrameProbe;
    /** The failure the last attempt hit, or `null` while none has occurred. */
    failure: CaptureFailure | null;
};

type CaptureResult =
    { status: "captured"; result: ScreenshotResult } |
    { status: "failed"; failure: CaptureFailure };

type CaptureOutcome =
    { status: "captured"; result: ScreenshotResult } |
    { status: "stalled"; failure: CaptureFailure };

const DEFAULT_SCREENSHOT_INTERVAL = 10;
const PRESENTATION_PROBE_MS = 250;

const NOT_PRESENTING_MESSAGE =
    "Screenshot failed: the display is not presenting frames to this window, so GTK has no rendered " +
    "content to capture. The window is hidden, minimized, or its compositor is not presenting it; this " +
    "is a display problem, not a widget problem.";

const EMPTY_WIDGET_HINT =
    "The display is presenting frames to this window, so the widget itself is empty: it painted nothing.";

const OTHER_FAILURE_HINT =
    "The display is presenting frames to this window, so the capture failed for another reason.";

const bytesToBase64 = (bytes: number[]): string => {
    return Buffer.from(bytes).toString("base64");
};

const describeWidgetState = (widget: Gtk.Widget): string =>
    `realized=${String(widget.getRealized())} mapped=${String(widget.getMapped())} ` +
    `visible=${String(widget.getVisible())}`;

const getMappedPopovers = (widget: Gtk.Widget): Gtk.Popover[] => {
    const popovers: Gtk.Popover[] = [];

    for (const descendant of descendants(widget)) {
        if (descendant instanceof Gtk.Popover && descendant.getMapped()) {
            popovers.push(descendant);
        }
    }

    return popovers;
};

const appendPopover = (snapshot: Gtk.Snapshot, target: Gtk.Widget, popover: Gtk.Popover): void => {
    const [hasBounds, bounds] = popover.computeBounds(target);
    const paintable = new Gtk.WidgetPaintable({ widget: popover });
    const width = paintable.getIntrinsicWidth();
    const height = paintable.getIntrinsicHeight();

    if (!hasBounds || width <= 0 || height <= 0) {
        return;
    }

    snapshot.save();
    snapshot.translate(new Graphene.Point({ x: bounds.origin.x, y: bounds.origin.y }));
    paintable.snapshot(snapshot, width, height);
    snapshot.restore();
};

const appendPopovers = (snapshot: Gtk.Snapshot, target: Gtk.Widget): void => {
    for (const popover of getMappedPopovers(target)) {
        appendPopover(snapshot, target, popover);
    }
};

const getSurface = (widget: Gtk.Widget): Gdk.Surface | null => widget.getNative()?.getSurface() ?? null;
const isSurfaceOnScreen = (widget: Gtk.Widget): boolean => getSurface(widget)?.getMapped() ?? false;

const getFrameClock = (widget: Gtk.Widget): Gdk.FrameClock | null =>
    widget.getRoot()?.getFrameClock() ?? widget.getFrameClock();

const getFrameCounter = (widget: Gtk.Widget): bigint | null => getFrameClock(widget)?.getFrameCounter() ?? null;

const describePresentation = (widget: Gtk.Widget): string =>
    `${describeWidgetState(widget)} surfaceMapped=${String(isSurfaceOnScreen(widget))} ` +
    `frameCounter=${String(getFrameCounter(widget))}`;

const requestFrame = (widget: Gtk.Widget): void => {
    getFrameClock(widget)?.requestPhase(Gdk.FrameClockPhase.UPDATE);
};

const startFrameProbe = (widget: Gtk.Widget): FrameProbe => {
    requestFrame(widget);

    return { counter: getFrameCounter(widget), startedAt: Date.now() };
};

const updateFrameProbe = (widget: Gtk.Widget, probe: FrameProbe): void => {
    requestFrame(widget);

    if (probe.counter !== null) {
        return;
    }

    const counter = getFrameCounter(widget);

    if (counter !== null) {
        probe.counter = counter;
        probe.startedAt = Date.now();
    }
};

const hasFrameAdvanced = (widget: Gtk.Widget, probe: FrameProbe): boolean => {
    const counter = getFrameCounter(widget);

    return counter !== null && probe.counter !== null && counter > probe.counter;
};

const isPresenting = (widget: Gtk.Widget, probe: FrameProbe): boolean =>
    isSurfaceOnScreen(widget) && hasFrameAdvanced(widget, probe);

const isPresentationStalled = (widget: Gtk.Widget, probe: FrameProbe): boolean =>
    Date.now() - probe.startedAt >= PRESENTATION_PROBE_MS && !isPresenting(widget, probe);

const allocateRoot = (widget: Gtk.Widget): void => {
    const root = widget.getRoot();

    if (!root) {
        return;
    }

    const width = root.getWidth();
    const height = root.getHeight();

    if (width > 0 && height > 0) {
        root.allocate(width, height, -1, null);
    }
};

const isDirectlyPaintable = (child: Gtk.Widget): boolean =>
    child.getMapped() && child.getWidth() > 0 && !(child instanceof Gtk.Popover);

const getPaintableNode = (widget: Gtk.Widget, scale: number, width: number, height: number): Gsk.RenderNode | null => {
    const paintable = new Gtk.WidgetPaintable({ widget });
    const snapshot = new Gtk.Snapshot();
    snapshot.scale(scale, scale);
    paintable.snapshot(snapshot, width, height);
    appendPopovers(snapshot, widget);

    return snapshot.toNode();
};

const getChildrenNode = (widget: Gtk.Widget, scale: number): Gsk.RenderNode | null => {
    const snapshot = new Gtk.Snapshot();
    snapshot.scale(scale, scale);

    for (let child = widget.getFirstChild(); child !== null; child = child.getNextSibling()) {
        if (isDirectlyPaintable(child)) {
            widget.snapshotChild(child, snapshot);
        }
    }

    appendPopovers(snapshot, widget);

    return snapshot.toNode();
};

const getRenderNode = (widget: Gtk.Widget, scale: number, width: number, height: number): Gsk.RenderNode | null => {
    const presented = getPaintableNode(widget, scale, width, height);

    if (presented) {
        return presented;
    }

    allocateRoot(widget);

    return getPaintableNode(widget, scale, width, height) ?? getChildrenNode(widget, scale);
};

const renderToPng = (widget: Gtk.Widget, node: Gsk.RenderNode, width: number, height: number): ScreenshotResult => {
    const renderer = new Gsk.CairoRenderer();
    renderer.realizeForDisplay(widget.getDisplay());

    try {
        const viewport = Graphene.Rect.alloc().init(0, 0, width, height);
        const texture = renderer.renderTexture(node, viewport);
        const data = texture.saveToPngBytes().getData();

        if (!data) {
            throw new Error("Failed to serialize screenshot to PNG");
        }

        return { data: bytesToBase64(data), mimeType: "image/png", width, height };
    } finally {
        renderer.unrealize();
    }
};

const captureSnapshot = (widget: Gtk.Widget, scale: number): CaptureResult => {
    const paintable = new Gtk.WidgetPaintable({ widget });
    const width = paintable.getIntrinsicWidth();
    const height = paintable.getIntrinsicHeight();

    if (width <= 0 || height <= 0) {
        return { status: "failed", failure: "no-size" };
    }

    const renderNode = getRenderNode(widget, scale, width, height);

    if (!renderNode) {
        return { status: "failed", failure: "no-content" };
    }

    const scaledWidth = Math.round(width * scale);
    const scaledHeight = Math.round(height * scale);

    return { status: "captured", result: renderToPng(widget, renderNode, scaledWidth, scaledHeight) };
};

const failureMessage = (widget: Gtk.Widget, failure: CaptureFailure): string =>
    failure === "no-size"
        ? `Widget has no size: ensure it is realized and visible (${describeWidgetState(widget)})`
        : `Widget produced no render content (${describeWidgetState(widget)})`;

const notPresentingMessage = (widget: Gtk.Widget): string =>
    `${NOT_PRESENTING_MESSAGE} (${describePresentation(widget)})`;

const stalledMessage = (widget: Gtk.Widget, failure: CaptureFailure): string =>
    `${notPresentingMessage(widget)}\n\n${failureMessage(widget, failure)}`;

const presentingHint = (failure: CaptureFailure | null): string =>
    failure === "no-content" ? EMPTY_WIDGET_HINT : OTHER_FAILURE_HINT;

const timeoutHint = (widget: Gtk.Widget, state: CaptureState): string =>
    isPresenting(widget, state.probe) ? presentingHint(state.failure) : notPresentingMessage(widget);

const explainTimeout = (error: Error, widget: Gtk.Widget, state: CaptureState): Error =>
    getConfig().getElementError(`${error.message}\n\n${timeoutHint(widget, state)}`);

const attemptCapture = (widget: Gtk.Widget, scale: number, state: CaptureState): CaptureOutcome => {
    const attempt = captureSnapshot(widget, scale);

    if (attempt.status === "captured") {
        return attempt;
    }

    state.failure = attempt.failure;
    updateFrameProbe(widget, state.probe);

    if (isPresentationStalled(widget, state.probe)) {
        return { status: "stalled", failure: attempt.failure };
    }

    throw new Error(failureMessage(widget, attempt.failure));
};

/**
 * Captures a PNG snapshot of a widget, retrying until it has a paintable size.
 * Popovers open inside the widget render on their own surfaces, so they are
 * composited into the image at their on-screen positions. A display that never
 * presents a frame leaves GTK without a cached render node, so the widget's
 * contents are then snapshotted directly; when even that yields nothing, the
 * failure names the display instead of blaming the widget.
 *
 * @param widget The widget to render to an image.
 * @param options Optional scale, timeout, and retry interval.
 * @returns The base64-encoded PNG data along with its mime type and dimensions.
 */
const screenshot = async (widget: Gtk.Widget, options?: ScreenshotOptions): Promise<ScreenshotResult> => {
    const scale = options?.scale ?? 1;

    if (!Number.isFinite(scale) || scale <= 0) {
        throw new Error(`Screenshot scale must be a positive number, got ${String(scale)}`);
    }

    const state: CaptureState = { probe: startFrameProbe(widget), failure: null };

    const outcome = await waitFor(() => attemptCapture(widget, scale, state), {
        timeout: options?.timeout,
        interval: options?.interval ?? DEFAULT_SCREENSHOT_INTERVAL,
        onTimeout: (error) => explainTimeout(error, widget, state),
    });

    if (outcome.status === "stalled") {
        throw new Error(stalledMessage(widget, outcome.failure));
    }

    return outcome.result;
};

const firstToplevelWindow = (windows: Gtk.Widget[]): Gtk.Window => {
    const [first] = windows;

    if (!(first instanceof Gtk.Window)) {
        throw new TypeError("First toplevel is not a Window");
    }

    return first;
};

const windowAtIndex = (windows: Gtk.Widget[], index: number): Gtk.Window => {
    const indexed = windows[index];

    if (!(indexed instanceof Gtk.Window)) {
        throw new TypeError(`Window at index ${String(index)} not found`);
    }

    return indexed;
};

const isWindow = (widget: Gtk.Widget): widget is Gtk.Window => widget instanceof Gtk.Window;

const hasMatchingTitle = (window: Gtk.Window, selector: string | RegExp): boolean => {
    const title = window.getTitle() ?? "";

    return selector instanceof RegExp ? selector.test(title) : title.includes(selector);
};

const describeTitleSelector = (selector: string | RegExp): string =>
    selector instanceof RegExp ? selector.toString() : `"${selector}"`;

const windowByTitle = (windows: Gtk.Widget[], selector: string | RegExp): Gtk.Window => {
    const found = windows.filter(isWindow).find((window) => hasMatchingTitle(window, selector));

    if (!found) {
        throw new Error(`No window found with title matching ${describeTitleSelector(selector)}`);
    }

    return found;
};

const resolveWindow = (selector?: WindowSelector): Gtk.Window => {
    const windows = Gtk.Window.listToplevels();

    if (windows.length === 0) {
        throw new Error("No windows available for screenshot");
    }

    if (selector === undefined) {
        return firstToplevelWindow(windows);
    }

    if (typeof selector === "number") {
        return windowAtIndex(windows, selector);
    }

    return windowByTitle(windows, selector);
};

const saveScreenshotToTempFile = (result: ScreenshotResult): string => {
    const dir = mkdtempSync(join(tmpdir(), "gtkx-screenshots-"));
    const filepath = join(dir, "screenshot.png");
    writeFileSync(filepath, Buffer.from(result.data, "base64"));

    return filepath;
};

/**
 * Prints a clickable file URL for a saved screenshot to the console.
 *
 * @param filepath Absolute path of the saved screenshot file.
 */
const logScreenshotPath = (filepath: string): void => {
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
const captureAndSaveScreenshot = async (
    selector?: WindowSelector,
    options?: ScreenshotOptions,
): Promise<ScreenshotResult> => {
    const target = resolveWindow(selector);
    const result = await screenshot(target, options);
    logScreenshotPath(saveScreenshotToTempFile(result));

    return result;
};

export { screenshot, logScreenshotPath, captureAndSaveScreenshot };

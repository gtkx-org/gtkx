import * as Gdk from "@gtkx/gi/gdk";
import * as Graphene from "@gtkx/gi/graphene";
import * as Gsk from "@gtkx/gi/gsk";
import * as Gtk from "@gtkx/gi/gtk";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import type { ScreenshotOptions, ScreenshotResult } from "./types.js";
import { getConfig } from "./config.js";
import { now } from "./timers.js";
import { descendants } from "./traversal.js";
import { waitFor } from "./wait-for.js";
import { activeToplevel, mappedToplevels } from "./window-state.js";

type FrameProbe = {
    counter: bigint | null;
    startedAt: number;
};

type CaptureFailure = "no-size" | "no-content";

type CaptureState = {
    probe: FrameProbe;
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

const NOTHING_ON_SCREEN_MESSAGE = "Nothing is on screen to capture: no toplevel window is mapped";

const bytesToBase64 = (bytes: Uint8Array | number[]): string => Buffer.from(bytes).toString("base64");

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

    return { counter: getFrameCounter(widget), startedAt: now() };
};

const updateFrameProbe = (widget: Gtk.Widget, probe: FrameProbe): void => {
    requestFrame(widget);

    if (probe.counter !== null) {
        return;
    }

    const counter = getFrameCounter(widget);

    if (counter !== null) {
        probe.counter = counter;
        probe.startedAt = now();
    }
};

const hasFrameAdvanced = (widget: Gtk.Widget, probe: FrameProbe): boolean => {
    const counter = getFrameCounter(widget);

    return counter !== null && probe.counter !== null && counter > probe.counter;
};

const isPresenting = (widget: Gtk.Widget, probe: FrameProbe): boolean =>
    isSurfaceOnScreen(widget) && hasFrameAdvanced(widget, probe);

const isPresentationStalled = (widget: Gtk.Widget, probe: FrameProbe): boolean =>
    now() - probe.startedAt >= PRESENTATION_PROBE_MS && !isPresenting(widget, probe);

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

const writeScreenshot = (result: ScreenshotResult, path: string): void => {
    mkdirSync(dirname(path), { recursive: true });
    writeFileSync(path, Buffer.from(result.data, "base64"));
};

const captureUntilPaintable = (
    widget: Gtk.Widget,
    scale: number,
    options: ScreenshotOptions | undefined,
): Promise<CaptureOutcome> => {
    const state: CaptureState = { probe: startFrameProbe(widget), failure: null };

    return waitFor(() => attemptCapture(widget, scale, state), {
        timeout: options?.timeout,
        interval: options?.interval ?? DEFAULT_SCREENSHOT_INTERVAL,
        onTimeout: (error) => explainTimeout(error, widget, state),
    });
};

/**
 * Captures a PNG snapshot of a widget, retrying until it has a paintable size,
 * and writes the image to `options.path` when one is given, creating any
 * missing parent directories. Popovers open inside the widget render on their
 * own surfaces, so they are composited into the image at their on-screen
 * positions. A display that never presents a frame leaves GTK without a cached
 * render node, so the widget's contents are then snapshotted directly; when
 * even that yields nothing, the failure names the display instead of blaming
 * the widget.
 *
 * @param widget The widget to render to an image.
 * @param options Optional scale, timeout, retry interval, and output path.
 * @returns The base64-encoded PNG data along with its mime type and dimensions.
 */
const screenshot = async (widget: Gtk.Widget, options?: ScreenshotOptions): Promise<ScreenshotResult> => {
    const scale = options?.scale ?? 1;

    if (!Number.isFinite(scale) || scale <= 0) {
        throw new Error(`Screenshot scale must be a positive number, got ${String(scale)}`);
    }

    const outcome = await captureUntilPaintable(widget, scale, options);

    if (outcome.status === "stalled") {
        throw new Error(stalledMessage(widget, outcome.failure));
    }

    if (options?.path) {
        writeScreenshot(outcome.result, options.path);
    }

    return outcome.result;
};

const screenTarget = (): Gtk.Window => {
    const target = activeToplevel() ?? mappedToplevels()[0];

    if (!target) {
        throw new Error(NOTHING_ON_SCREEN_MESSAGE);
    }

    return target;
};

const captureScreen = async (options?: ScreenshotOptions): Promise<ScreenshotResult> =>
    screenshot(screenTarget(), options);

export { captureScreen, screenshot };

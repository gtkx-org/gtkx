import * as Gdk from "@gtkx/gi/gdk";
import * as GObject from "@gtkx/gi/gobject";
import * as Graphene from "@gtkx/gi/graphene";
import * as Gtk from "@gtkx/gi/gtk";
import { t, toValueHandle, wrapHandle } from "@gtkx/runtime";
import { toValue } from "@gtkx/runtime/internal";
import { runInAct } from "../act.js";
import { findControllerOwner } from "./controller.js";
import { dispatchOnControllers, dispatchOnOrCreateControllers } from "./dispatch.js";
import { wrapPointerEvent } from "./event-wrapper.js";
import { usageError } from "../usage-error.js";

/** The value delivered to a drop target: a primitive (converted to a GObject.Value) or an explicit GObject.Value. */
type DropContent = string | number | boolean | GObject.Value;

/** Options for a drop: the drop coordinates within the target. */
type DropOptions = {
    /** Horizontal drop coordinate within the target, in pixels. */
    x?: number;
    /** Vertical drop coordinate within the target, in pixels. */
    y?: number;
};

type DragPhase = "drag-begin" | "drag-update" | "drag-end";

/** A drag offset relative to the drag start point. */
type DragOffset = {
    /** Horizontal distance from the drag start point, in pixels. */
    x: number;
    /** Vertical distance from the drag start point, in pixels. */
    y: number;
};

/**
 * Options for a drag gesture: the starting point, the number of interpolated drag updates, or
 * explicit intermediate offsets emitted before the final one.
 */
type DragOptions = {
    /** Horizontal coordinate the drag begins at; defaults to 0. */
    startX?: number;
    /** Vertical coordinate the drag begins at; defaults to 0. */
    startY?: number;
    /** Number of evenly interpolated drag updates, the last of which is the requested offset; defaults to 2. */
    steps?: number;
    /** Explicit intermediate offsets emitted before the requested one, used instead of `steps`. */
    offsets?: DragOffset[];
};

type DragInstancePatch = {
    getStartPoint?: Gtk.GestureDrag["getStartPoint"] | undefined;
    getOffset?: Gtk.GestureDrag["getOffset"] | undefined;
};

type ZoomInstancePatch = {
    getBoundingBoxCenter?: Gtk.GestureZoom["getBoundingBoxCenter"] | undefined;
};

type SavedDragState = {
    instance: DragInstancePatch;
    hasOwnStartPoint: boolean;
    hasOwnOffset: boolean;
    previousStartPoint: DragInstancePatch["getStartPoint"];
    previousOffset: DragInstancePatch["getOffset"];
};

const buildDropValue = (content: DropContent): GObject.Value => {
    if (content instanceof GObject.Value) {
        return content;
    }

    const handle = typeof content === "number" ? toValue(t.float64, content) : toValueHandle(content);

    return wrapHandle(handle, GObject.Value);
};

const toOwnerPoint = (widget: Gtk.Widget, owner: Gtk.Widget, x: number, y: number): DragOffset => {
    if (widget === owner) {
        return { x, y };
    }

    const [isComputed, translated] = widget.computePoint(owner, new Graphene.Point({ x, y }));

    return isComputed ? { x: translated.x, y: translated.y } : { x, y };
};

/** Enters a widget. */
const hover = (widget: Gtk.Widget): Promise<void> =>
    dispatchOnOrCreateControllers(widget, Gtk.EventControllerMotion, (controller) => {
        controller.emit("enter", 0, 0);
    });

/** Leaves a widget. */
const unhover = (widget: Gtk.Widget): Promise<void> =>
    dispatchOnOrCreateControllers(widget, Gtk.EventControllerMotion, (controller) => {
        controller.emit("leave");
    });

/** Rotates a widget's gestures. */
const rotate = (widget: Gtk.Widget, angle: number, deltaAngle: number = angle): Promise<void> =>
    dispatchOnControllers(widget, Gtk.GestureRotate, (controller) => {
        controller.emit("angle-changed", angle, deltaAngle);
    });

/** Zooms a widget's gestures. */
const zoom = (widget: Gtk.Widget, scale: number): Promise<void> =>
    dispatchOnControllers(widget, Gtk.GestureZoom, (controller, owner) => {
        const instance: ZoomInstancePatch = controller;
        const hasOwnCenter = Object.hasOwn(instance, "getBoundingBoxCenter");
        const previousCenter = instance.getBoundingBoxCenter;
        const center = toOwnerPoint(widget, owner, widget.getWidth() / 2, widget.getHeight() / 2);
        instance.getBoundingBoxCenter = () => [true, center.x, center.y];

        try {
            controller.emit("scale-changed", scale);
        } finally {
            if (hasOwnCenter) {
                instance.getBoundingBoxCenter = previousCenter;
            } else {
                delete instance.getBoundingBoxCenter;
            }
        }
    });

/** Swipes a widget's gestures. */
const swipe = (widget: Gtk.Widget, velocityX: number, velocityY: number): Promise<void> =>
    dispatchOnControllers(widget, Gtk.GestureSwipe, (controller) => {
        controller.emit("swipe", velocityX, velocityY);
    });

/** Long-presses a widget. */
const longPress = (widget: Gtk.Widget, x = 0, y = 0): Promise<void> =>
    dispatchOnControllers(widget, Gtk.GestureLongPress, (controller, owner) => {
        const point = toOwnerPoint(widget, owner, x, y);
        controller.emit("pressed", point.x, point.y);
    });

const restoreDragState = (saved: SavedDragState): void => {
    const { instance } = saved;

    if (saved.hasOwnStartPoint) {
        instance.getStartPoint = saved.previousStartPoint;
    } else {
        delete instance.getStartPoint;
    }

    if (saved.hasOwnOffset) {
        instance.getOffset = saved.previousOffset;
    } else {
        delete instance.getOffset;
    }
};

const patchDragState = (controller: Gtk.GestureDrag, start: DragOffset, offset: () => DragOffset): (() => void) => {
    const instance: DragInstancePatch = controller;

    const saved: SavedDragState = {
        instance,
        hasOwnStartPoint: Object.hasOwn(instance, "getStartPoint"),
        hasOwnOffset: Object.hasOwn(instance, "getOffset"),
        previousStartPoint: instance.getStartPoint,
        previousOffset: instance.getOffset,
    };

    instance.getStartPoint = () => [true, start.x, start.y];

    instance.getOffset = () => {
        const current = offset();

        return [true, current.x, current.y];
    };

    return () => {
        restoreDragState(saved);
    };
};

const emitToControllers = (controllers: Gtk.GestureDrag[], signal: DragPhase, x: number, y: number): void => {
    for (const controller of controllers) {
        controller.emit(signal, x, y);
    }
};

const runDragSequence = (controllers: Gtk.GestureDrag[], start: DragOffset, updates: DragOffset[]): void => {
    let current: DragOffset = { x: 0, y: 0 };
    const restores = controllers.map((controller) => patchDragState(controller, start, () => current));

    try {
        emitToControllers(controllers, "drag-begin", start.x, start.y);

        for (const update of updates) {
            current = update;
            emitToControllers(controllers, "drag-update", update.x, update.y);
        }

        emitToControllers(controllers, "drag-end", current.x, current.y);
    } finally {
        for (const restore of restores) {
            restore();
        }
    }
};

const resolveDragUpdates = (dx: number, dy: number, options: DragOptions): DragOffset[] => {
    if (options.offsets) {
        return [...options.offsets, { x: dx, y: dy }];
    }

    const steps = Math.max(1, Math.floor(options.steps ?? 2));
    const updates: DragOffset[] = [];

    for (let i = 1; i <= steps; i++) {
        updates.push({ x: (dx * i) / steps, y: (dy * i) / steps });
    }

    return updates;
};

/** Drags a widget by an offset. */
const drag = async (widget: Gtk.Widget, dx: number, dy: number, options: DragOptions = {}): Promise<void> => {
    if (widget instanceof Gtk.Range) {
        throw usageError(
            new TypeError(
                "userEvent.drag cannot drive a Gtk.Range's built-in slider " +
                    "(its drag reads pointer coordinates from the display); " +
                    "use userEvent.slide(range, value) or userEvent.keyboard for sliders",
            ),
        );
    }

    const updates = resolveDragUpdates(dx, dy, options);

    await wrapPointerEvent(widget, () => {
        const owner = findControllerOwner(widget, Gtk.GestureDrag);
        const start = toOwnerPoint(widget, owner.widget, options.startX ?? 0, options.startY ?? 0);
        runDragSequence(owner.controllers, start, updates);
    });
};

type DropSite = {
    targets: Gtk.DropTarget[];
    point: DragOffset;
};

const resolveDropSite = (target: Gtk.Widget, options: DropOptions): DropSite => {
    const owner = findControllerOwner(target, Gtk.DropTarget);

    return { targets: owner.controllers, point: toOwnerPoint(target, owner.widget, options.x ?? 0, options.y ?? 0) };
};

const didEmitAcceptedDrop = (target: Gtk.Widget, content: DropContent, options: DropOptions): boolean => {
    const { targets, point } = resolveDropSite(target, options);
    let isAccepted = false;

    for (const dropTarget of targets) {
        isAccepted = dropTarget.emit("drop", buildDropValue(content), point.x, point.y) || isAccepted;
    }

    return isAccepted;
};

type ActiveDrag = {
    source: Gtk.DragSource;
    drag: Gdk.Drag;
};

type DragEnvironment = {
    surface: Gdk.Surface;
    device: Gdk.Device;
    fallback: Gdk.ContentProvider | undefined;
};

const resolveDragEnvironment = (widget: Gtk.Widget, content: DropContent | undefined): DragEnvironment => {
    const surface = widget.getNative()?.getSurface() ?? null;
    const device = widget.getDisplay().getDefaultSeat()?.getPointer() ?? null;

    if (surface === null || device === null) {
        throw usageError(new Error("The drag source has no surface or pointer device"));
    }

    return {
        surface,
        device,
        fallback: content === undefined ? undefined : Gdk.ContentProvider.newForValue(buildDropValue(content)),
    };
};

const beginDragSource = (source: Gtk.DragSource, environment: DragEnvironment): ActiveDrag => {
    const provider = source.emit("prepare", 0, 0) ?? source.getContent() ?? environment.fallback;

    if (provider === undefined) {
        throw usageError(new Error("The drag source did not provide content"));
    }

    const drag = Gdk.Drag.begin(environment.surface, environment.device, provider, source.getActions(), 0, 0);

    if (drag === null) {
        throw usageError(new Error("The display refused to begin the drag"));
    }

    return { source, drag };
};

const endDragSources = (activeDrags: ActiveDrag[], isAccepted: boolean): void => {
    for (const { source, drag } of activeDrags) {
        drag.dropDone(isAccepted);
        source.emit("drag-end", drag, false);
    }
};

const beginDragSources = (
    widget: Gtk.Widget,
    sources: Gtk.DragSource[],
    content: DropContent | undefined,
): ActiveDrag[] => {
    const environment = resolveDragEnvironment(widget, content);
    const activeDrags: ActiveDrag[] = [];

    try {
        for (const source of sources) {
            const active = beginDragSource(source, environment);
            activeDrags.push(active);
            source.emit("drag-begin", active.drag);
        }
    } catch (error) {
        endDragSources(activeDrags, false);
        throw error;
    }

    return activeDrags;
};

const didEmitProviderValue = (provider: Gdk.ContentProvider, target: Gtk.DropTarget, point: DragOffset): boolean => {
    const formats = target.getFormats();
    const type = formats === null ? GObject.TYPE_INVALID : formats.matchGtype(provider.refFormats());

    if (type === GObject.TYPE_INVALID) {
        return false;
    }

    const value = new GObject.Value();
    value.init(type);
    provider.getValue(value);

    return target.emit("drop", value, point.x, point.y);
};

const didEmitProviderDrop = (target: Gtk.Widget, drags: ActiveDrag[], options: DropOptions): boolean => {
    const { targets, point } = resolveDropSite(target, options);

    return drags.some(({ drag }) =>
        targets.some((dropTarget) => didEmitProviderValue(drag.getContent(), dropTarget, point)),
    );
};

/** Drops content on a widget. */
const drop = (widget: Gtk.Widget, content: DropContent, options: DropOptions = {}): Promise<void> =>
    wrapPointerEvent(widget, () => {
        didEmitAcceptedDrop(widget, content, options);
    });

/** Drags content from one widget and drops it on another. */
const dragAndDrop = async (
    source: Gtk.Widget,
    target: Gtk.Widget,
    content?: DropContent,
    options: DropOptions = {},
): Promise<void> => {
    let activeDrags: ActiveDrag[] = [];
    let isAccepted = false;

    try {
        await wrapPointerEvent(source, () => {
            const owner = findControllerOwner(source, Gtk.DragSource);
            activeDrags = beginDragSources(owner.widget, owner.controllers, content);
        });

        await wrapPointerEvent(target, () => {
            isAccepted =
                content === undefined
                    ? didEmitProviderDrop(target, activeDrags, options)
                    : didEmitAcceptedDrop(target, content, options);
        });
    } finally {
        await runInAct(() => {
            endDragSources(activeDrags, isAccepted);
        });
    }
};

export {
    hover,
    unhover,
    rotate,
    zoom,
    swipe,
    longPress,
    drag,
    drop,
    dragAndDrop,
    type DropContent,
    type DropOptions,
    type DragOffset,
    type DragOptions,
};

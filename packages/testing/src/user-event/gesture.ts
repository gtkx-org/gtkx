import * as GObject from "@gtkx/gi/gobject";
import * as Gtk from "@gtkx/gi/gtk";
import { getAllControllers } from "./controller.js";
import { dispatchOnControllers, dispatchOnOrCreateControllers } from "./dispatch.js";
import { wrapEvent } from "./event-wrapper.js";

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

type SavedDragState = {
    instance: DragInstancePatch;
    hasOwnStartPoint: boolean;
    hasOwnOffset: boolean;
    previousStartPoint: DragInstancePatch["getStartPoint"];
    previousOffset: DragInstancePatch["getOffset"];
};

const initValue = (gtype: GObject.Type, populate: (value: GObject.Value) => void): GObject.Value => {
    const value = new GObject.Value();
    value.init(gtype);
    populate(value);

    return value;
};

const buildDropValue = (content: DropContent): GObject.Value => {
    if (content instanceof GObject.Value) {
        return content;
    }

    if (typeof content === "string") {
        return initValue(GObject.TYPE_STRING, (v) => {
            v.setString(content);
        });
    }

    if (typeof content === "boolean") {
        return initValue(GObject.TYPE_BOOLEAN, (v) => {
            v.setBoolean(content);
        });
    }

    return initValue(GObject.TYPE_DOUBLE, (v) => {
        v.setDouble(content);
    });
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
    },
    );

/** Zooms a widget's gestures. */
const zoom = (widget: Gtk.Widget, scale: number): Promise<void> =>
    dispatchOnControllers(widget, Gtk.GestureZoom, (controller) => {
        controller.emit("scale-changed", scale);
    });

/** Swipes a widget's gestures. */
const swipe = (widget: Gtk.Widget, velocityX: number, velocityY: number): Promise<void> =>
    dispatchOnControllers(widget, Gtk.GestureSwipe, (controller) => {
        controller.emit("swipe", velocityX, velocityY);
    });

/** Long-presses a widget. */
const longPress = (widget: Gtk.Widget, x = 0, y = 0): Promise<void> =>
    dispatchOnControllers(widget, Gtk.GestureLongPress, (controller) => {
        controller.emit("pressed", x, y);
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
        throw new TypeError(
            "userEvent.drag cannot drive a Gtk.Range's built-in slider " +
            "(its drag reads pointer coordinates from the display); " +
            "use userEvent.slide(range, value) or userEvent.keyboard for sliders",
        );
    }

    const start = { x: options.startX ?? 0, y: options.startY ?? 0 };
    const updates = resolveDragUpdates(dx, dy, options);

    await wrapEvent(widget, () => {
        runDragSequence(getAllControllers(widget, Gtk.GestureDrag), start, updates);
    });
};

const emitDrop = (target: Gtk.Widget, content: DropContent, options: DropOptions): void => {
    const dropTargets = getAllControllers(target, Gtk.DropTarget);

    for (const dropTarget of dropTargets) {
        dropTarget.emit("drop", buildDropValue(content), options.x ?? 0, options.y ?? 0);
    }
};

/** Drops content on a widget. */
const drop = (widget: Gtk.Widget, content: DropContent, options: DropOptions = {}): Promise<void> =>
    wrapEvent(widget, () => {
        emitDrop(widget, content, options);
    });

/** Drags content from one widget and drops it on another. */
const dragAndDrop = async (
    source: Gtk.Widget,
    target: Gtk.Widget,
    content: DropContent,
    options: DropOptions = {},
): Promise<void> => {
    await wrapEvent(source, () => {
        getAllControllers(source, Gtk.DragSource);
    });

    await wrapEvent(target, () => {
        emitDrop(target, content, options);
    });
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

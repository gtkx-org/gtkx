import * as GObject from "@gtkx/gi/gobject";
import * as Gtk from "@gtkx/gi/gtk";
import { act } from "./act.js";
import { findController, getOrCreateController } from "./controller.js";

/**
 * Content payload accepted by {@link userEvent.drop} and
 * {@link userEvent.dragAndDrop}.
 *
 * Primitives are auto-marshalled to a `GObject.Value` of the matching `GType`.
 * Pre-constructed `GObject.Value` instances are forwarded unchanged so callers
 * can supply boxed / object types that the auto-marshaller does not cover.
 */
export type DropContent = string | number | boolean | GObject.Value;

/**
 * Optional drop coordinates relative to the target widget.
 */
export type DropOptions = {
    /** X coordinate of the drop, in widget-local pixels (default: 0). */
    x?: number;
    /** Y coordinate of the drop, in widget-local pixels (default: 0). */
    y?: number;
};

/**
 * Options for {@link userEvent.drag}.
 */
export type DragOptions = {
    /** X coordinate where the drag begins, in widget-local pixels (default: 0). */
    startX?: number;
    /** Y coordinate where the drag begins, in widget-local pixels (default: 0). */
    startY?: number;
};

const wrapValue = (content: DropContent): GObject.Value => {
    if (content instanceof GObject.Value) return content;
    const value = new GObject.Value();
    if (typeof content === "string") {
        value.init(GObject.TYPE_STRING);
        value.setString(content);
        return value;
    }
    if (typeof content === "boolean") {
        value.init(GObject.TYPE_BOOLEAN);
        value.setBoolean(content);
        return value;
    }
    value.init(GObject.TYPE_DOUBLE);
    value.setDouble(content);
    return value;
};

/**
 * Simulates mouse entering a widget (hover).
 *
 * Triggers the "enter" signal on the widget's EventControllerMotion.
 *
 * @param widget - The widget to hover over.
 */
export const hover = async (widget: Gtk.Widget): Promise<void> => {
    await act(() => {
        const controller = getOrCreateController(widget, Gtk.EventControllerMotion);
        controller.emit("enter", 0, 0);
    });
};

/**
 * Simulates mouse leaving a widget (unhover).
 *
 * Triggers the "leave" signal on the widget's EventControllerMotion.
 *
 * @param widget - The widget to stop hovering over.
 */
export const unhover = async (widget: Gtk.Widget): Promise<void> => {
    await act(() => {
        const controller = getOrCreateController(widget, Gtk.EventControllerMotion);
        controller.emit("leave");
    });
};

/**
 * Simulates a rotate gesture on a widget.
 *
 * Locates the widget's `Gtk.GestureRotate` controller and emits
 * `angle-changed` with the given absolute and delta angles in radians.
 * Throws if the widget has no `GestureRotate` controller attached.
 *
 * @param widget - The widget receiving the gesture
 * @param angle - Absolute rotation angle in radians
 * @param deltaAngle - Angle delta since gesture start, in radians (default: `angle`)
 */
export const rotate = async (widget: Gtk.Widget, angle: number, deltaAngle: number = angle): Promise<void> => {
    await act(() => {
        const controller = findController(widget, Gtk.GestureRotate);
        controller.emit("angle-changed", angle, deltaAngle);
    });
};

/**
 * Simulates a pinch-zoom gesture on a widget.
 *
 * Locates the widget's `Gtk.GestureZoom` controller and emits
 * `scale-changed` with the given scale factor. Throws if the widget
 * has no `GestureZoom` controller attached.
 *
 * @param widget - The widget receiving the gesture
 * @param scale - The new scale factor (1 = no zoom)
 */
export const zoom = async (widget: Gtk.Widget, scale: number): Promise<void> => {
    await act(() => {
        const controller = findController(widget, Gtk.GestureZoom);
        controller.emit("scale-changed", scale);
    });
};

/**
 * Simulates a swipe gesture on a widget.
 *
 * Locates the widget's `Gtk.GestureSwipe` controller and emits `swipe`
 * with the supplied velocity vector. Throws if the widget has no
 * `GestureSwipe` controller attached.
 *
 * @param widget - The widget receiving the gesture
 * @param velocityX - Horizontal velocity in pixels per second
 * @param velocityY - Vertical velocity in pixels per second
 */
export const swipe = async (widget: Gtk.Widget, velocityX: number, velocityY: number): Promise<void> => {
    await act(() => {
        const controller = findController(widget, Gtk.GestureSwipe);
        controller.emit("swipe", velocityX, velocityY);
    });
};

/**
 * Simulates a long-press gesture on a widget.
 *
 * Locates the widget's `Gtk.GestureLongPress` controller and emits
 * `pressed` at the supplied coordinates. Throws if the widget has no
 * `GestureLongPress` controller attached.
 *
 * @param widget - The widget receiving the gesture
 * @param x - X coordinate in widget-local pixels (default: 0)
 * @param y - Y coordinate in widget-local pixels (default: 0)
 */
export const longPress = async (widget: Gtk.Widget, x: number = 0, y: number = 0): Promise<void> => {
    await act(() => {
        const controller = findController(widget, Gtk.GestureLongPress);
        controller.emit("pressed", x, y);
    });
};

type DragInstancePatch = Partial<Pick<Gtk.GestureDrag, "getStartPoint" | "getOffset">>;

const withGestureDragState = <T>(
    controller: Gtk.GestureDrag,
    startX: number,
    startY: number,
    runWithOffset: (setOffset: (dx: number, dy: number) => void) => T,
): T => {
    const instance: DragInstancePatch = controller;
    const ownsStartPoint = Object.hasOwn(instance, "getStartPoint");
    const ownsOffset = Object.hasOwn(instance, "getOffset");
    const previousStartPoint = instance.getStartPoint;
    const previousOffset = instance.getOffset;
    let offsetX = 0;
    let offsetY = 0;
    instance.getStartPoint = () => [true, startX, startY];
    instance.getOffset = () => [true, offsetX, offsetY];
    const setOffset = (dx: number, dy: number): void => {
        offsetX = dx;
        offsetY = dy;
    };
    try {
        return runWithOffset(setOffset);
    } finally {
        if (ownsStartPoint) instance.getStartPoint = previousStartPoint;
        else delete instance.getStartPoint;
        if (ownsOffset) instance.getOffset = previousOffset;
        else delete instance.getOffset;
    }
};

/**
 * Simulates a click-drag gesture on a widget.
 *
 * Locates the widget's `Gtk.GestureDrag` controller and emits the
 * `drag-begin` → `drag-update` → `drag-end` sequence with the supplied
 * offset. Throws if the widget has no `GestureDrag` controller attached.
 *
 * @param widget - The widget receiving the gesture
 * @param dx - Horizontal offset from the gesture origin
 * @param dy - Vertical offset from the gesture origin
 * @param options - Coordinates where the drag begins
 */
export const drag = async (widget: Gtk.Widget, dx: number, dy: number, options: DragOptions = {}): Promise<void> => {
    const startX = options.startX ?? 0;
    const startY = options.startY ?? 0;
    await act(() => {
        const controller = findController(widget, Gtk.GestureDrag);
        withGestureDragState(controller, startX, startY, (setOffset) => {
            controller.emit("drag-begin", startX, startY);
            setOffset(dx, dy);
            controller.emit("drag-update", dx, dy);
            controller.emit("drag-end", dx, dy);
        });
    });
};

const emitDrop = (target: Gtk.Widget, content: DropContent, options: DropOptions): void => {
    const dropTarget = findController(target, Gtk.DropTarget);
    dropTarget.emit("drop", wrapValue(content), options.x ?? 0, options.y ?? 0);
};

/**
 * Simulates a drop onto a widget's `Gtk.DropTarget`.
 *
 * Wraps the supplied content in a `GObject.Value` (strings → `G_TYPE_STRING`,
 * numbers → `G_TYPE_DOUBLE`, booleans → `G_TYPE_BOOLEAN`; pre-constructed
 * `GObject.Value` instances are forwarded unchanged) and emits `drop`.
 * Throws if the widget has no `DropTarget` controller attached.
 *
 * @param widget - The drop target widget
 * @param content - Payload value (auto-marshalled or a pre-built GObject.Value)
 * @param options - Drop coordinates relative to the widget
 */
export const drop = async (widget: Gtk.Widget, content: DropContent, options: DropOptions = {}): Promise<void> => {
    await act(() => {
        emitDrop(widget, content, options);
    });
};

/**
 * Simulates dragging from one widget and dropping on another.
 *
 * Verifies the source widget has a `Gtk.DragSource` controller, then
 * fires a `drop` on the target widget's `Gtk.DropTarget` with the
 * supplied content. Throws if either controller is missing.
 *
 * @param source - Widget that initiates the drag
 * @param target - Widget that receives the drop
 * @param content - Payload value (auto-marshalled or a pre-built GObject.Value)
 * @param options - Drop coordinates relative to the target
 */
export const dragAndDrop = async (
    source: Gtk.Widget,
    target: Gtk.Widget,
    content: DropContent,
    options: DropOptions = {},
): Promise<void> => {
    await act(() => {
        findController(source, Gtk.DragSource);
        emitDrop(target, content, options);
    });
};

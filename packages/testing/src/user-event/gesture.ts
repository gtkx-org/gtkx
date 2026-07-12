import * as GObject from "@gtkx/gi/gobject";
import * as Gtk from "@gtkx/gi/gtk";
import { getController } from "./controller.js";
import { dispatchOnController, dispatchOnOrCreateController } from "./dispatch.js";
import { wrapEvent } from "./event-wrapper.js";

/** The value delivered to a drop target: a primitive (converted to a GObject.Value) or an explicit GObject.Value. */
export type DropContent = string | number | boolean | GObject.Value;

/** Options for a drop: the drop coordinates within the target. */
export type DropOptions = {
    x?: number;
    y?: number;
};

/** Options for a drag gesture: the starting point of the drag. */
export type DragOptions = {
    startX?: number;
    startY?: number;
};

const buildDropValue = (content: DropContent): GObject.Value => {
    if (content instanceof GObject.Value) return content;
    if (typeof content === "string") {
        return GObject.buildValue(GObject.TYPE_STRING, (v) => v.setString(content));
    }
    if (typeof content === "boolean") {
        return GObject.buildValue(GObject.TYPE_BOOLEAN, (v) => v.setBoolean(content));
    }
    return GObject.buildValue(GObject.TYPE_DOUBLE, (v) => v.setDouble(content));
};

/** Simulates the pointer entering the widget by dispatching a motion controller enter event. */
export const hover = (widget: Gtk.Widget): Promise<void> =>
    dispatchOnOrCreateController(widget, Gtk.EventControllerMotion, (controller) => controller.emit("enter", 0, 0));

/** Simulates the pointer leaving the widget by dispatching a motion controller leave event. */
export const unhover = (widget: Gtk.Widget): Promise<void> =>
    dispatchOnOrCreateController(widget, Gtk.EventControllerMotion, (controller) => controller.emit("leave"));

/**
 * Simulates a two-finger rotate gesture on the widget.
 * @param widget Widget with a rotate gesture controller.
 * @param angle Absolute rotation angle in radians.
 * @param deltaAngle Change in angle since the gesture began (defaults to `angle`).
 */
export const rotate = (widget: Gtk.Widget, angle: number, deltaAngle: number = angle): Promise<void> =>
    dispatchOnController(widget, Gtk.GestureRotate, (controller) =>
        controller.emit("angle-changed", angle, deltaAngle),
    );

/**
 * Simulates a pinch-zoom gesture on the widget by the given scale factor.
 * @param widget Widget with a zoom gesture controller.
 * @param scale Scale factor to apply.
 */
export const zoom = (widget: Gtk.Widget, scale: number): Promise<void> =>
    dispatchOnController(widget, Gtk.GestureZoom, (controller) => controller.emit("scale-changed", scale));

/**
 * Simulates a swipe gesture on the widget with the given velocity.
 * @param widget Widget with a swipe gesture controller.
 * @param velocityX Horizontal velocity of the swipe.
 * @param velocityY Vertical velocity of the swipe.
 */
export const swipe = (widget: Gtk.Widget, velocityX: number, velocityY: number): Promise<void> =>
    dispatchOnController(widget, Gtk.GestureSwipe, (controller) => controller.emit("swipe", velocityX, velocityY));

/**
 * Simulates a long press on the widget at the given coordinates.
 * @param widget Widget with a long-press gesture controller.
 * @param x Horizontal press position.
 * @param y Vertical press position.
 */
export const longPress = (widget: Gtk.Widget, x: number = 0, y: number = 0): Promise<void> =>
    dispatchOnController(widget, Gtk.GestureLongPress, (controller) => controller.emit("pressed", x, y));

type DragInstancePatch = {
    getStartPoint?: Gtk.GestureDrag["getStartPoint"] | undefined;
    getOffset?: Gtk.GestureDrag["getOffset"] | undefined;
};

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
 * Simulates dragging the widget by the given offset via its drag gesture controller.
 * @param widget Widget to drag.
 * @param dx Horizontal drag offset.
 * @param dy Vertical drag offset.
 * @param options Starting point of the drag.
 */
export const drag = async (widget: Gtk.Widget, dx: number, dy: number, options: DragOptions = {}): Promise<void> => {
    if (widget instanceof Gtk.Range) {
        throw new Error(
            "userEvent.drag cannot drive a Gtk.Range's built-in slider (its drag reads real pointer coordinates); " +
                "use userEvent.slide(range, value) or userEvent.keyboard for sliders",
        );
    }
    const startX = options.startX ?? 0;
    const startY = options.startY ?? 0;
    await wrapEvent(widget, () => {
        const controller = getController(widget, Gtk.GestureDrag);
        withGestureDragState(controller, startX, startY, (setOffset) => {
            controller.emit("drag-begin", startX, startY);
            setOffset(dx, dy);
            controller.emit("drag-update", dx, dy);
            controller.emit("drag-end", dx, dy);
        });
    });
};

const emitDrop = (target: Gtk.Widget, content: DropContent, options: DropOptions): void => {
    const dropTarget = getController(target, Gtk.DropTarget);
    dropTarget.emit("drop", buildDropValue(content), options.x ?? 0, options.y ?? 0);
};

/**
 * Simulates dropping content onto the widget's drop target at the given coordinates.
 * @param widget Widget with a drop target controller.
 * @param content Value to deliver to the drop target.
 * @param options Drop coordinates within the target.
 */
export const drop = (widget: Gtk.Widget, content: DropContent, options: DropOptions = {}): Promise<void> =>
    wrapEvent(widget, () => {
        emitDrop(widget, content, options);
    });

/**
 * Simulates dragging from the source widget and dropping the content onto the target widget's drop target.
 * @param source Widget the drag originates from.
 * @param target Widget with a drop target controller.
 * @param content Value to deliver to the drop target.
 * @param options Drop coordinates within the target.
 */
export const dragAndDrop = async (
    source: Gtk.Widget,
    target: Gtk.Widget,
    content: DropContent,
    options: DropOptions = {},
): Promise<void> => {
    await wrapEvent(source, () => {
        getController(source, Gtk.DragSource);
    });
    await wrapEvent(target, () => {
        emitDrop(target, content, options);
    });
};

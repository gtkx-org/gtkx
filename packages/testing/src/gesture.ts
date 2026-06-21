import * as GObject from "@gtkx/gi/gobject";
import * as Gtk from "@gtkx/gi/gtk";
import { findController } from "./controller.js";
import { dispatchOnController, dispatchOnExistingController, runInAct } from "./dispatch.js";

export type DropContent = string | number | boolean | GObject.Value;

export type DropOptions = {
    x?: number;
    y?: number;
};

export type DragOptions = {
    startX?: number;
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

export const hover = (widget: Gtk.Widget): Promise<void> =>
    dispatchOnController(widget, Gtk.EventControllerMotion, (controller) => controller.emit("enter", 0, 0));

export const unhover = (widget: Gtk.Widget): Promise<void> =>
    dispatchOnController(widget, Gtk.EventControllerMotion, (controller) => controller.emit("leave"));

export const rotate = (widget: Gtk.Widget, angle: number, deltaAngle: number = angle): Promise<void> =>
    dispatchOnExistingController(widget, Gtk.GestureRotate, (controller) =>
        controller.emit("angle-changed", angle, deltaAngle),
    );

export const zoom = (widget: Gtk.Widget, scale: number): Promise<void> =>
    dispatchOnExistingController(widget, Gtk.GestureZoom, (controller) => controller.emit("scale-changed", scale));

export const swipe = (widget: Gtk.Widget, velocityX: number, velocityY: number): Promise<void> =>
    dispatchOnExistingController(widget, Gtk.GestureSwipe, (controller) =>
        controller.emit("swipe", velocityX, velocityY),
    );

export const longPress = (widget: Gtk.Widget, x: number = 0, y: number = 0): Promise<void> =>
    dispatchOnExistingController(widget, Gtk.GestureLongPress, (controller) => controller.emit("pressed", x, y));

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

export const drag = async (widget: Gtk.Widget, dx: number, dy: number, options: DragOptions = {}): Promise<void> => {
    const startX = options.startX ?? 0;
    const startY = options.startY ?? 0;
    await runInAct(() => {
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

export const drop = (widget: Gtk.Widget, content: DropContent, options: DropOptions = {}): Promise<void> =>
    runInAct(() => {
        emitDrop(widget, content, options);
    });

export const dragAndDrop = (
    source: Gtk.Widget,
    target: Gtk.Widget,
    content: DropContent,
    options: DropOptions = {},
): Promise<void> =>
    runInAct(() => {
        findController(source, Gtk.DragSource);
        emitDrop(target, content, options);
    });

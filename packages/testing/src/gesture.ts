import * as GObject from "@gtkx/gi/gobject";
import * as Gtk from "@gtkx/gi/gtk";
import { act } from "./act.js";
import { findController, getOrCreateController } from "./controller.js";

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

export const hover = async (widget: Gtk.Widget): Promise<void> => {
    await act(() => {
        const controller = getOrCreateController(widget, Gtk.EventControllerMotion);
        controller.emit("enter", 0, 0);
    });
};

export const unhover = async (widget: Gtk.Widget): Promise<void> => {
    await act(() => {
        const controller = getOrCreateController(widget, Gtk.EventControllerMotion);
        controller.emit("leave");
    });
};

export const rotate = async (widget: Gtk.Widget, angle: number, deltaAngle: number = angle): Promise<void> => {
    await act(() => {
        const controller = findController(widget, Gtk.GestureRotate);
        controller.emit("angle-changed", angle, deltaAngle);
    });
};

export const zoom = async (widget: Gtk.Widget, scale: number): Promise<void> => {
    await act(() => {
        const controller = findController(widget, Gtk.GestureZoom);
        controller.emit("scale-changed", scale);
    });
};

export const swipe = async (widget: Gtk.Widget, velocityX: number, velocityY: number): Promise<void> => {
    await act(() => {
        const controller = findController(widget, Gtk.GestureSwipe);
        controller.emit("swipe", velocityX, velocityY);
    });
};

export const longPress = async (widget: Gtk.Widget, x: number = 0, y: number = 0): Promise<void> => {
    await act(() => {
        const controller = findController(widget, Gtk.GestureLongPress);
        controller.emit("pressed", x, y);
    });
};

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

export const drop = async (widget: Gtk.Widget, content: DropContent, options: DropOptions = {}): Promise<void> => {
    await act(() => {
        emitDrop(widget, content, options);
    });
};

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

import { createRef } from "@gtkx/ffi";
import * as Gdk from "@gtkx/ffi/gdk";
import * as Gtk from "@gtkx/ffi/gtk";
import type { SignalHandler } from "./signal-store.js";
import { signalStore } from "./signal-store.js";

type ControllerType =
    | "motion"
    | "click"
    | "key"
    | "scroll"
    | "dragSource"
    | "dropTarget"
    | "gestureDrag"
    | "gestureStylus"
    | "gestureRotate";

type PropToControllerMap = {
    [propName: string]: {
        type: ControllerType;
        signalName?: string;
        isConfig?: boolean;
    };
};

const PROP_CONTROLLER_MAP: PropToControllerMap = {
    onEnter: { type: "motion", signalName: "enter" },
    onLeave: { type: "motion", signalName: "leave" },
    onMotion: { type: "motion", signalName: "motion" },
    onPressed: { type: "click", signalName: "pressed" },
    onReleased: { type: "click", signalName: "released" },
    onKeyPressed: { type: "key", signalName: "key-pressed" },
    onKeyReleased: { type: "key", signalName: "key-released" },
    onScroll: { type: "scroll", signalName: "scroll" },
    onDragPrepare: { type: "dragSource", signalName: "prepare" },
    onDragBegin: { type: "dragSource", signalName: "drag-begin" },
    onDragEnd: { type: "dragSource", signalName: "drag-end" },
    onDragCancel: { type: "dragSource", signalName: "drag-cancel" },
    dragActions: { type: "dragSource", isConfig: true },
    dragIcon: { type: "dragSource", isConfig: true },
    dragIconHotX: { type: "dragSource", isConfig: true },
    dragIconHotY: { type: "dragSource", isConfig: true },
    onDrop: { type: "dropTarget", signalName: "drop" },
    onDropEnter: { type: "dropTarget", signalName: "enter" },
    onDropLeave: { type: "dropTarget", signalName: "leave" },
    onDropMotion: { type: "dropTarget", signalName: "motion" },
    dropActions: { type: "dropTarget", isConfig: true },
    dropTypes: { type: "dropTarget", isConfig: true },
    onGestureDragBegin: { type: "gestureDrag", signalName: "drag-begin" },
    onGestureDragUpdate: { type: "gestureDrag", signalName: "drag-update" },
    onGestureDragEnd: { type: "gestureDrag", signalName: "drag-end" },
    onStylusDown: { type: "gestureStylus", signalName: "down" },
    onStylusMotion: { type: "gestureStylus", signalName: "motion" },
    onStylusUp: { type: "gestureStylus", signalName: "up" },
    onStylusProximity: { type: "gestureStylus", signalName: "proximity" },
    onRotateAngleChanged: { type: "gestureRotate", signalName: "angle-changed" },
    onRotateBegin: { type: "gestureRotate", signalName: "begin" },
    onRotateEnd: { type: "gestureRotate", signalName: "end" },
};

export const EVENT_CONTROLLER_PROPS = new Set(Object.keys(PROP_CONTROLLER_MAP));

type ControllerFactory = () => Gtk.EventController;

export class EventControllerManager {
    private owner: object;
    private widget: Gtk.Widget;
    private controllers: Map<ControllerType, Gtk.EventController> = new Map();
    private pendingDragIcon: Gdk.Paintable | null | undefined = undefined;
    private pendingDragIconHotX: number | undefined = undefined;
    private pendingDragIconHotY: number | undefined = undefined;

    private readonly controllerFactories: Record<ControllerType, ControllerFactory> = {
        motion: () => new Gtk.EventControllerMotion(),
        click: () => new Gtk.GestureClick(),
        key: () => new Gtk.EventControllerKey(),
        scroll: () => new Gtk.EventControllerScroll(Gtk.EventControllerScrollFlags.BOTH_AXES),
        dragSource: () => {
            const controller = new Gtk.DragSource();
            controller.setActions(Gdk.DragAction.COPY);
            return controller;
        },
        dropTarget: () => new Gtk.DropTarget(0, Gdk.DragAction.COPY),
        gestureDrag: () => new Gtk.GestureDrag(),
        gestureStylus: () => {
            const controller = new Gtk.GestureStylus();
            controller.setStylusOnly(false);
            return controller;
        },
        gestureRotate: () => new Gtk.GestureRotate(),
    };

    constructor(owner: object, widget: Gtk.Widget) {
        this.owner = owner;
        this.widget = widget;
    }

    public updateProp(propName: string, handlerOrValue: SignalHandler | unknown | null): void {
        const config = PROP_CONTROLLER_MAP[propName];
        if (!config) return;

        const controller = this.ensureController(config.type);
        if (!controller) return;

        if (config.isConfig) {
            this.handleConfigProp(propName, handlerOrValue, controller);
        } else if (config.signalName) {
            this.handleSignalProp(propName, config.signalName, handlerOrValue as SignalHandler | null, controller);
        }
    }

    public dispose(): void {
        for (const controller of this.controllers.values()) {
            this.widget.removeController(controller);
        }
        this.controllers.clear();
    }

    private ensureController(type: ControllerType): Gtk.EventController {
        let controller = this.controllers.get(type);

        if (!controller) {
            controller = this.controllerFactories[type]();
            this.widget.addController(controller);
            this.controllers.set(type, controller);
        }

        return controller;
    }

    private handleConfigProp(propName: string, value: unknown, controller: Gtk.EventController): void {
        if (propName === "dragActions" && controller instanceof Gtk.DragSource) {
            controller.setActions((value as Gdk.DragAction) ?? Gdk.DragAction.COPY);
        } else if (propName === "dropActions" && controller instanceof Gtk.DropTarget) {
            controller.setActions((value as Gdk.DragAction) ?? Gdk.DragAction.COPY);
        } else if (propName === "dropTypes" && controller instanceof Gtk.DropTarget) {
            const types = (value as number[]) ?? [];
            controller.setGtypes(types.length, types);
        } else if (propName === "dragIcon" && controller instanceof Gtk.DragSource) {
            this.pendingDragIcon = value as Gdk.Paintable | null | undefined;
            this.applyDragIcon(controller);
        } else if (propName === "dragIconHotX" && controller instanceof Gtk.DragSource) {
            this.pendingDragIconHotX = value as number | undefined;
            this.applyDragIcon(controller);
        } else if (propName === "dragIconHotY" && controller instanceof Gtk.DragSource) {
            this.pendingDragIconHotY = value as number | undefined;
            this.applyDragIcon(controller);
        }
    }

    private applyDragIcon(controller: Gtk.DragSource): void {
        if (this.pendingDragIcon === undefined) return;
        const hotX = this.pendingDragIconHotX ?? 0;
        const hotY = this.pendingDragIconHotY ?? 0;
        controller.setIcon(hotX, hotY, this.pendingDragIcon);
    }

    private handleSignalProp(
        propName: string,
        signalName: string,
        handler: SignalHandler | null,
        controller: Gtk.EventController,
    ): void {
        if (controller instanceof Gtk.GestureStylus) {
            const stylusHandler = this.createStylusHandler(propName, handler);
            signalStore.set(this.owner, controller, signalName, stylusHandler);
        } else {
            const wrappedHandler = this.createEventHandler(handler, controller);
            signalStore.set(this.owner, controller, signalName, wrappedHandler);
        }
    }

    private createEventHandler(
        handler: SignalHandler | null,
        controller: Gtk.EventController,
    ): SignalHandler | undefined {
        if (!handler) return undefined;

        return (_self: unknown, ...args: unknown[]) => {
            const event = controller.getCurrentEvent();
            return handler(...args, event);
        };
    }

    private createStylusHandler(propName: string, handler: SignalHandler | null): SignalHandler | undefined {
        if (!handler) return undefined;

        const needsAxisData = propName === "onStylusDown" || propName === "onStylusMotion";

        if (needsAxisData) {
            return (gesture: Gtk.GestureStylus, x: number, y: number) => {
                const pressureRef = createRef(0);
                const tiltXRef = createRef(0);
                const tiltYRef = createRef(0);

                gesture.getAxis(Gdk.AxisUse.PRESSURE, pressureRef);
                gesture.getAxis(Gdk.AxisUse.XTILT, tiltXRef);
                gesture.getAxis(Gdk.AxisUse.YTILT, tiltYRef);

                const event = gesture.getCurrentEvent();
                handler(x, y, pressureRef.value || 0.5, tiltXRef.value || 0, tiltYRef.value || 0, event);
            };
        }

        return (gesture: Gtk.GestureStylus, x: number, y: number) => {
            const event = gesture.getCurrentEvent();
            handler(x, y, event);
        };
    }
}

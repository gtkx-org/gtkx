import { batch, createRef, isObjectEqual, NativeObject } from "@gtkx/ffi";
import * as Gdk from "@gtkx/ffi/gdk";
import type * as GObject from "@gtkx/ffi/gobject";
import * as Gtk from "@gtkx/ffi/gtk";
import { CONSTRUCTOR_PROPS } from "../generated/internal.js";
import { Node } from "../node.js";
import { registerNodeClass } from "../registry.js";
import type { Container, ContainerClass, Props } from "../types.js";
import { EVENT_CONTROLLER_PROPS } from "./internal/constants.js";
import {
    hasSingleContent,
    type InsertableWidget,
    isAddable,
    isAppendable,
    isEditable,
    isInsertable,
    isRemovable,
    isReorderable,
    isSingleChild,
    type ReorderableWidget,
} from "./internal/predicates.js";
import { type SignalHandler, signalStore } from "./internal/signal-store.js";
import { filterProps, isContainerType, resolvePropMeta, resolveSignal } from "./internal/utils.js";
import { ShortcutControllerNode } from "./shortcut-controller.js";
import { SlotNode } from "./slot.js";

const PROPS = ["children", "widthRequest", "heightRequest", "grabFocus"];

export class WidgetNode<T extends Gtk.Widget = Gtk.Widget, P extends Props = Props> extends Node<T, P> {
    public static override priority = 3;

    private motionController?: Gtk.EventControllerMotion;
    private clickController?: Gtk.GestureClick;
    private keyController?: Gtk.EventControllerKey;
    private scrollController?: Gtk.EventControllerScroll;
    private dragSourceController?: Gtk.DragSource;
    private dropTargetController?: Gtk.DropTarget;
    private gestureDragController?: Gtk.GestureDrag;
    private gestureStylusController?: Gtk.GestureStylus;

    public static override matches(_type: string, containerOrClass?: Container | ContainerClass | null): boolean {
        return isContainerType(Gtk.Widget, containerOrClass);
    }

    public static override createContainer(props: Props, containerClass: typeof Gtk.Widget): Container | null {
        const WidgetClass = containerClass;
        const typeName = WidgetClass.glibTypeName;
        const args = (CONSTRUCTOR_PROPS[typeName] ?? []).map((name) => props[name]);

        return new WidgetClass(...(args as ConstructorParameters<typeof Gtk.Widget>));
    }

    public appendChild(child: Node): void {
        if (child instanceof ShortcutControllerNode) {
            child.setParent(this.container);
            return;
        }

        if (child instanceof SlotNode) {
            child.setParent(this.container);
            return;
        }

        if (!(child instanceof WidgetNode)) {
            throw new Error(`Cannot append '${child.typeName}' to 'Widget': expected WidgetNode child`);
        }

        if (child.container instanceof Gtk.Window) {
            throw new Error(`Cannot append 'Window' to '${this.typeName}': windows must be top-level containers`);
        }

        batch(() => this.attachChild(child));
    }

    public removeChild(child: Node): void {
        if (child instanceof ShortcutControllerNode) {
            child.setParent(undefined);
            return;
        }

        if (child instanceof SlotNode) {
            return;
        }

        if (!(child instanceof WidgetNode)) {
            throw new Error(`Cannot remove '${child.typeName}' from 'Widget': expected WidgetNode child`);
        }

        if (child.container instanceof Gtk.Window) {
            throw new Error(`Cannot remove 'Window' from '${this.typeName}': windows must be top-level containers`);
        }

        batch(() => this.detachChild(child));
    }

    public insertBefore(child: Node, before: Node): void {
        if (child instanceof ShortcutControllerNode) {
            child.setParent(this.container);
            return;
        }

        if (child instanceof SlotNode) {
            child.setParent(this.container);
            return;
        }

        if (!(child instanceof WidgetNode) || !(before instanceof WidgetNode)) {
            throw new Error(
                `Cannot insert '${child.typeName}' before '${before.typeName}': expected WidgetNode children`,
            );
        }

        if (child.container instanceof Gtk.Window) {
            throw new Error(`Cannot insert 'Window' into '${this.typeName}': windows must be top-level containers`);
        }

        batch(() => {
            if (isReorderable(this.container)) {
                this.insertBeforeReorderable(this.container, child, before);
            } else if (isInsertable(this.container)) {
                this.insertBeforeInsertable(this.container, child, before);
            } else {
                this.appendChild(child);
            }
        });
    }

    private insertBeforeReorderable(container: ReorderableWidget, child: WidgetNode, before: WidgetNode): void {
        const previousSibling = this.findPreviousSibling(before);
        const currentParent = child.container.getParent();
        const isChildOfThisContainer = currentParent && isObjectEqual(currentParent, container);

        if (isChildOfThisContainer) {
            container.reorderChildAfter(child.container, previousSibling);
        } else {
            this.detachChildFromParent(child);
            container.insertChildAfter(child.container, previousSibling);
        }
    }

    private insertBeforeInsertable(container: InsertableWidget, child: WidgetNode, before: WidgetNode): void {
        this.detachChildFromParent(child);
        const position = this.findInsertPosition(before);
        container.insert(child.container, position);
    }

    public updateProps(oldProps: P | null, newProps: P): void {
        this.updateSizeRequest(oldProps, newProps);
        this.updateGrabFocus(oldProps, newProps);

        const propNames = new Set([
            ...Object.keys(filterProps(oldProps ?? {}, PROPS)),
            ...Object.keys(filterProps(newProps ?? {}, PROPS)),
        ]);

        const pendingSignals: Array<{ name: string; newValue: unknown }> = [];
        const pendingProperties: Array<{ name: string; oldValue: unknown; newValue: unknown }> = [];

        for (const name of propNames) {
            const oldValue = oldProps?.[name];
            const newValue = newProps[name];

            if (oldValue === newValue) continue;

            if (EVENT_CONTROLLER_PROPS.has(name)) {
                pendingSignals.push({ name, newValue });
                continue;
            }

            if (name === "onNotify") {
                pendingSignals.push({ name, newValue });
                continue;
            }

            const signalName = this.propNameToSignalName(name);

            if (resolveSignal(this.container, signalName)) {
                pendingSignals.push({ name, newValue });
            } else if (newValue !== undefined) {
                pendingProperties.push({ name, oldValue, newValue });
            }
        }

        for (const { name, newValue } of pendingSignals) {
            if (EVENT_CONTROLLER_PROPS.has(name)) {
                this.updateEventControllerProp(name, (newValue as SignalHandler) ?? null);
            } else if (name === "onNotify") {
                this.updateNotifyHandler((newValue as SignalHandler) ?? null);
            } else {
                const signalName = this.propNameToSignalName(name);
                const handler = typeof newValue === "function" ? (newValue as SignalHandler) : undefined;
                signalStore.set(this, this.container, signalName, handler);
            }
        }

        for (const { name, oldValue, newValue } of pendingProperties) {
            const isEditableText = name === "text" && isEditable(this.container);

            if (isEditableText && oldValue !== undefined) {
                const currentValue = this.getProperty(name);

                if (oldValue !== currentValue) {
                    continue;
                }
            }

            this.setProperty(name, newValue);
        }
    }

    private updateSizeRequest(oldProps: P | null, newProps: P): void {
        const oldWidth = oldProps?.widthRequest as number | undefined;
        const oldHeight = oldProps?.heightRequest as number | undefined;
        const newWidth = newProps.widthRequest as number | undefined;
        const newHeight = newProps.heightRequest as number | undefined;

        if (oldWidth !== newWidth || oldHeight !== newHeight) {
            this.container.setSizeRequest(newWidth ?? -1, newHeight ?? -1);
        }
    }

    private updateGrabFocus(oldProps: P | null, newProps: P): void {
        const oldGrabFocus = oldProps?.grabFocus as boolean | undefined;
        const newGrabFocus = newProps.grabFocus as boolean | undefined;

        if (!oldGrabFocus && newGrabFocus) {
            this.container.grabFocus();
        }
    }

    private updateEventControllerProp(propName: string, handlerOrValue: SignalHandler | unknown | null): void {
        const wrappedHandler =
            typeof handlerOrValue === "function"
                ? (_self: unknown, ...args: unknown[]) => (handlerOrValue as SignalHandler)(...args)
                : undefined;

        switch (propName) {
            case "onEnter":
            case "onLeave":
            case "onMotion": {
                if (!this.motionController) {
                    this.motionController = new Gtk.EventControllerMotion();
                    this.container.addController(this.motionController);
                }
                const signalName = propName === "onEnter" ? "enter" : propName === "onLeave" ? "leave" : "motion";
                signalStore.set(this, this.motionController, signalName, wrappedHandler);
                break;
            }
            case "onPressed":
            case "onReleased": {
                if (!this.clickController) {
                    this.clickController = new Gtk.GestureClick();
                    this.container.addController(this.clickController);
                }
                const signalName = propName === "onPressed" ? "pressed" : "released";
                signalStore.set(this, this.clickController, signalName, wrappedHandler);
                break;
            }
            case "onKeyPressed":
            case "onKeyReleased": {
                if (!this.keyController) {
                    this.keyController = new Gtk.EventControllerKey();
                    this.container.addController(this.keyController);
                }
                const signalName = propName === "onKeyPressed" ? "key-pressed" : "key-released";
                signalStore.set(this, this.keyController, signalName, wrappedHandler);
                break;
            }
            case "onScroll": {
                if (!this.scrollController) {
                    this.scrollController = new Gtk.EventControllerScroll(Gtk.EventControllerScrollFlags.BOTH_AXES);
                    this.container.addController(this.scrollController);
                }
                signalStore.set(this, this.scrollController, "scroll", wrappedHandler);
                break;
            }
            case "onDragPrepare":
            case "onDragBegin":
            case "onDragEnd":
            case "onDragCancel":
            case "dragActions": {
                const dragSource = this.ensureDragSource();
                if (propName === "dragActions") {
                    dragSource.setActions((handlerOrValue as Gdk.DragAction) ?? Gdk.DragAction.COPY);
                } else {
                    const signalName =
                        propName === "onDragPrepare"
                            ? "prepare"
                            : propName === "onDragBegin"
                              ? "drag-begin"
                              : propName === "onDragEnd"
                                ? "drag-end"
                                : "drag-cancel";
                    signalStore.set(this, dragSource, signalName, wrappedHandler);
                }
                break;
            }
            case "onDrop":
            case "onDropEnter":
            case "onDropLeave":
            case "onDropMotion":
            case "dropActions":
            case "dropTypes": {
                const dropTarget = this.ensureDropTarget();
                if (propName === "dropActions") {
                    dropTarget.setActions((handlerOrValue as Gdk.DragAction) ?? Gdk.DragAction.COPY);
                } else if (propName === "dropTypes") {
                    const types = (handlerOrValue as number[]) ?? [];
                    dropTarget.setGtypes(types.length, types);
                } else {
                    const signalName =
                        propName === "onDrop"
                            ? "drop"
                            : propName === "onDropEnter"
                              ? "enter"
                              : propName === "onDropLeave"
                                ? "leave"
                                : "motion";
                    signalStore.set(this, dropTarget, signalName, wrappedHandler);
                }
                break;
            }
            case "onGestureDragBegin":
            case "onGestureDragUpdate":
            case "onGestureDragEnd": {
                const gestureDrag = this.ensureGestureDrag();
                const signalName =
                    propName === "onGestureDragBegin"
                        ? "drag-begin"
                        : propName === "onGestureDragUpdate"
                          ? "drag-update"
                          : "drag-end";
                signalStore.set(this, gestureDrag, signalName, wrappedHandler);
                break;
            }
            case "onStylusDown":
            case "onStylusMotion":
            case "onStylusUp":
            case "onStylusProximity": {
                const gestureStylus = this.ensureGestureStylus();
                const signalName =
                    propName === "onStylusDown"
                        ? "down"
                        : propName === "onStylusMotion"
                          ? "motion"
                          : propName === "onStylusUp"
                            ? "up"
                            : "proximity";
                const stylusHandler = this.createStylusHandler(propName, handlerOrValue as SignalHandler | null);
                signalStore.set(this, gestureStylus, signalName, stylusHandler);
                break;
            }
        }
    }

    private ensureDragSource(): Gtk.DragSource {
        if (!this.dragSourceController) {
            this.dragSourceController = new Gtk.DragSource();
            this.dragSourceController.setActions(Gdk.DragAction.COPY);
            this.container.addController(this.dragSourceController);
        }
        return this.dragSourceController;
    }

    private ensureDropTarget(): Gtk.DropTarget {
        if (!this.dropTargetController) {
            this.dropTargetController = new Gtk.DropTarget(0, Gdk.DragAction.COPY);
            this.container.addController(this.dropTargetController);
        }
        return this.dropTargetController;
    }

    private ensureGestureDrag(): Gtk.GestureDrag {
        if (!this.gestureDragController) {
            this.gestureDragController = new Gtk.GestureDrag();
            this.container.addController(this.gestureDragController);
        }
        return this.gestureDragController;
    }

    private ensureGestureStylus(): Gtk.GestureStylus {
        if (!this.gestureStylusController) {
            this.gestureStylusController = new Gtk.GestureStylus();
            this.gestureStylusController.setStylusOnly(false);
            this.container.addController(this.gestureStylusController);
        }
        return this.gestureStylusController;
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

                handler(x, y, pressureRef.value || 0.5, tiltXRef.value || 0, tiltYRef.value || 0);
            };
        }

        return (_gesture: Gtk.GestureStylus, x: number, y: number) => {
            handler(x, y);
        };
    }

    private updateNotifyHandler(handler: SignalHandler | null): void {
        const wrappedHandler = handler
            ? (obj: Gtk.Widget, pspec: GObject.ParamSpec) => {
                  handler(obj, pspec.getName());
              }
            : undefined;

        signalStore.set(this, this.container, "notify", wrappedHandler);
    }

    private propNameToSignalName(name: string): string {
        return name
            .slice(2)
            .replace(/([A-Z])/g, "-$1")
            .toLowerCase()
            .replace(/^-/, "");
    }

    private getProperty(key: string): unknown {
        const propMeta = resolvePropMeta(this.container, key);
        if (!propMeta) return undefined;

        const [getterName] = propMeta;
        const getter = getterName ? this.container[getterName as keyof typeof this.container] : undefined;

        if (getter && typeof getter === "function") {
            return getter.call(this.container);
        }

        return undefined;
    }

    private setProperty(key: string, value: unknown): void {
        const propMeta = resolvePropMeta(this.container, key);
        if (!propMeta) return;

        const [getterName, setterName] = propMeta;
        const setter = this.container[setterName as keyof typeof this.container];
        const getter = getterName ? this.container[getterName as keyof typeof this.container] : undefined;

        if (getter && typeof getter === "function") {
            const currentValue = getter.call(this.container);

            if (currentValue === value) {
                return;
            }

            if (
                currentValue instanceof NativeObject &&
                value instanceof NativeObject &&
                isObjectEqual(currentValue, value)
            ) {
                return;
            }
        }

        if (setter && typeof setter === "function") {
            setter.call(this.container, value);
        }
    }

    private detachChildFromParent(child: WidgetNode): void {
        const currentParent = child.container.getParent();
        if (currentParent !== null && isRemovable(currentParent)) {
            currentParent.remove(child.container);
        }
    }

    private attachChild(child: WidgetNode): void {
        if (isAppendable(this.container)) {
            this.detachChildFromParent(child);
            this.container.append(child.container);
        } else if (isAddable(this.container)) {
            this.detachChildFromParent(child);
            this.container.add(child.container);
        } else if (hasSingleContent(this.container)) {
            this.container.setContent(child.container);
        } else if (isSingleChild(this.container)) {
            this.container.setChild(child.container);
        } else {
            throw new Error(
                `Cannot append '${child.typeName}' to '${this.container.constructor.name}': container does not support children`,
            );
        }
    }

    private detachChild(child: WidgetNode): void {
        if (isRemovable(this.container)) {
            this.container.remove(child.container);
        } else if (hasSingleContent(this.container)) {
            this.container.setContent(null);
        } else if (isSingleChild(this.container)) {
            this.container.setChild(null);
        } else {
            throw new Error(
                `Cannot remove '${child.typeName}' from '${this.container.constructor.name}': container does not support child removal`,
            );
        }
    }

    private findPreviousSibling(before: WidgetNode): Gtk.Widget | undefined {
        let beforeChild = this.container.getFirstChild();

        while (beforeChild) {
            if (isObjectEqual(beforeChild, before.container)) {
                return beforeChild.getPrevSibling() ?? undefined;
            }
            beforeChild = beforeChild.getNextSibling();
        }

        throw new Error(`Cannot find 'before' child in container`);
    }

    private findInsertPosition(before: WidgetNode): number {
        let position = 0;
        let currentChild = this.container.getFirstChild();

        while (currentChild) {
            if (isObjectEqual(currentChild, before.container)) {
                return position;
            }
            position++;
            currentChild = currentChild.getNextSibling();
        }

        throw new Error(`Cannot find 'before' child in container`);
    }
}

registerNodeClass(WidgetNode);

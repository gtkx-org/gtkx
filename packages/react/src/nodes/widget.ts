import { batch, getNativeObject, isObjectEqual, NativeObject } from "@gtkx/ffi";
import type * as GObject from "@gtkx/ffi/gobject";
import { ObjectClass, Type, typeClassPeek, typeFromName, typeFundamental, TypeInstance, typeNameFromInstance } from "@gtkx/ffi/gobject";
import * as Gtk from "@gtkx/ffi/gtk";
import { CONSTRUCTOR_PROPS } from "../generated/internal.js";
import { Node } from "../node.js";
import { registerNodeClass } from "../registry.js";
import type { Container, ContainerClass, Props } from "../types.js";
import {
    getAttachmentStrategy,
    attachChild as performAttachment,
    detachChild as performDetachment,
} from "./internal/child-attachment.js";
import { EVENT_CONTROLLER_PROPS, EventControllerManager } from "./internal/event-controller-manager.js";
import {
    type InsertableWidget,
    isAttachable,
    isEditable,
    isInsertable,
    isRemovable,
    isReorderable,
    type ReorderableWidget,
} from "./internal/predicates.js";
import { type SignalHandler, signalStore } from "./internal/signal-store.js";
import { filterProps, matchesAnyClass, resolvePropMeta, resolveSignal } from "./internal/utils.js";

const EXCLUDED_PROPS = ["children", "widthRequest", "heightRequest", "grabFocus"];

function findProperty(obj: NativeObject, propertyName: string): GObject.ParamSpec | null {
    if (!obj.handle) return null;

    const typeInstance = getNativeObject(obj.handle, TypeInstance);
    const typeName = typeNameFromInstance(typeInstance);
    const gtype = typeFromName(typeName);
    const typeClass = typeClassPeek(gtype);
    if (!typeClass) return null;

    const objectClass = getNativeObject(typeClass.handle, ObjectClass);
    return objectClass.findProperty(propertyName) ?? null;
}

export class WidgetNode<T extends Gtk.Widget = Gtk.Widget, P extends Props = Props> extends Node<T, P> {
    public static override priority = 3;

    private eventControllerManager: EventControllerManager | null = null;

    public static override matches(_type: string, containerOrClass?: Container | ContainerClass | null): boolean {
        return matchesAnyClass([Gtk.Widget], containerOrClass);
    }

    public static override createContainer(props: Props, containerClass: typeof Gtk.Widget): Container | null {
        const WidgetClass = containerClass;
        const typeName = WidgetClass.glibTypeName;
        const args = (CONSTRUCTOR_PROPS[typeName] ?? []).map((name) => props[name]);

        return new WidgetClass(...(args as ConstructorParameters<typeof Gtk.Widget>));
    }

    public appendChild(child: Node): void {
        if (isAttachable(child) && child.canBeChildOf(this)) {
            child.attachTo(this);
            return;
        }

        if (!(child instanceof WidgetNode)) {
            throw new Error(`Cannot append '${child.typeName}' to 'Widget': expected Widget`);
        }

        if (child.container instanceof Gtk.Window) {
            throw new Error(`Cannot append 'Window' to '${this.typeName}': windows must be top-level containers`);
        }

        batch(() => this.attachChild(child));
    }

    public removeChild(child: Node): void {
        if (isAttachable(child) && child.canBeChildOf(this)) {
            child.detachFrom(this);
            return;
        }

        if (!(child instanceof WidgetNode)) {
            throw new Error(`Cannot remove '${child.typeName}' from 'Widget': expected Widget`);
        }

        if (child.container instanceof Gtk.Window) {
            throw new Error(`Cannot remove 'Window' from '${this.typeName}': windows must be top-level containers`);
        }

        batch(() => this.detachChild(child));
    }

    public insertBefore(child: Node, before: Node): void {
        if (isAttachable(child) && child.canBeChildOf(this)) {
            child.attachTo(this);
            return;
        }

        if (!(child instanceof WidgetNode) || !(before instanceof WidgetNode)) {
            throw new Error(`Cannot insert '${child.typeName}' into '${this.typeName}': expected Widget`);
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
            ...Object.keys(filterProps(oldProps ?? {}, EXCLUDED_PROPS)),
            ...Object.keys(filterProps(newProps ?? {}, EXCLUDED_PROPS)),
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
            } else if (oldValue !== undefined) {
                const defaultValue = this.getPropertyDefaultValue(name);
                if (defaultValue !== undefined) {
                    pendingProperties.push({ name, oldValue, newValue: defaultValue });
                }
            }
        }

        for (const { name, newValue } of pendingSignals) {
            if (EVENT_CONTROLLER_PROPS.has(name)) {
                this.ensureEventControllerManager().updateProp(name, (newValue as SignalHandler) ?? null);
            } else if (name === "onNotify") {
                this.setNotifyHandler((newValue as SignalHandler) ?? null);
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

    public override unmount(): void {
        this.eventControllerManager?.dispose();
        super.unmount();
    }

    private ensureEventControllerManager(): EventControllerManager {
        if (!this.eventControllerManager) {
            this.eventControllerManager = new EventControllerManager(this, this.container);
        }
        return this.eventControllerManager;
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

    private setNotifyHandler(handler: SignalHandler | null): void {
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

    private getPropertyDefaultValue(key: string): unknown {
        const propMeta = resolvePropMeta(this.container, key);
        if (!propMeta) return undefined;

        const propName = key.replace(/([A-Z])/g, "-$1").toLowerCase();
        const pspec = findProperty(this.container, propName);
        if (!pspec) return undefined;

        const value = pspec.getDefaultValue();
        const gtype = value.getType();
        const fundamental = typeFundamental(gtype);

        if (fundamental === Type.BOOLEAN) return value.getBoolean();
        if (fundamental === Type.INT) return value.getInt();
        if (fundamental === Type.UINT) return value.getUint();
        if (fundamental === Type.LONG) return value.getLong();
        if (fundamental === Type.ULONG) return value.getUlong();
        if (fundamental === Type.INT64) return value.getInt64();
        if (fundamental === Type.UINT64) return value.getUint64();
        if (fundamental === Type.FLOAT) return value.getFloat();
        if (fundamental === Type.DOUBLE) return value.getDouble();
        if (fundamental === Type.STRING) return value.getString();
        if (fundamental === Type.ENUM) return value.getEnum();
        if (fundamental === Type.FLAGS) return value.getFlags();

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
        const strategy = getAttachmentStrategy(this.container);
        if (!strategy) {
            throw new Error(
                `Cannot append '${child.typeName}' to '${this.container.constructor.name}': container does not support children`,
            );
        }
        if (strategy.type === "appendable" || strategy.type === "addable") {
            this.detachChildFromParent(child);
        }
        performAttachment(child.container, strategy);
    }

    private detachChild(child: WidgetNode): void {
        const strategy = getAttachmentStrategy(this.container);
        if (!strategy) {
            throw new Error(
                `Cannot remove '${child.typeName}' from '${this.container.constructor.name}': container does not support child removal`,
            );
        }
        performDetachment(child.container, strategy);
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

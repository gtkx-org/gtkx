import { getNativeObject, type NativeObject } from "@gtkx/ffi";
import type * as GObject from "@gtkx/ffi/gobject";
import {
    ObjectClass,
    ParamSpecString,
    Type,
    TypeInstance,
    typeClassRef,
    typeFromName,
    typeFundamental,
    typeNameFromInstance,
} from "@gtkx/ffi/gobject";
import * as Gtk from "@gtkx/ffi/gtk";
import { CONSTRUCTOR_PROPS } from "../generated/internal.js";
import { Node } from "../node.js";
import type { Container, Props } from "../types.js";
import {
    getAttachmentStrategy,
    attachChild as performAttachment,
    detachChild as performDetachment,
} from "./internal/child-attachment.js";
import {
    type InsertableWidget,
    isEditable,
    isInsertable,
    isRemovable,
    isReorderable,
    type ReorderableWidget,
} from "./internal/predicates.js";
import type { SignalHandler } from "./internal/signal-store.js";
import { filterProps, propNameToSignalName, resolvePropMeta, resolveSignal } from "./internal/utils.js";

const EXCLUDED_PROPS = ["children", "widthRequest", "heightRequest", "grabFocus"];

function findProperty(obj: NativeObject, key: string): GObject.ParamSpec | null {
    if (!obj.handle) return null;

    const propertyName = key.replace(/([A-Z])/g, "-$1").toLowerCase();
    const typeInstance = getNativeObject(obj.handle, TypeInstance);
    const typeName = typeNameFromInstance(typeInstance);
    const gtype = typeFromName(typeName);
    const typeClass = typeClassRef(gtype);
    const objectClass = getNativeObject(typeClass.handle, ObjectClass);
    return objectClass.findProperty(propertyName) ?? null;
}

export class WidgetNode<T extends Gtk.Widget = Gtk.Widget, P extends Props = Props> extends Node<T, P> {
    public static override createContainer(
        props: Props,
        containerClass: typeof Gtk.Widget,
        _rootContainer?: Container,
    ): Container | null {
        const WidgetClass = containerClass;
        const typeName = WidgetClass.glibTypeName;
        const args = (CONSTRUCTOR_PROPS[typeName] ?? []).map((name) => props[name]);

        return new WidgetClass(...(args as ConstructorParameters<typeof Gtk.Widget>));
    }

    public override isValidChild(child: Node): boolean {
        if (child instanceof WidgetNode) {
            return !(child.container instanceof Gtk.Window);
        }
        return true;
    }

    public override appendChild(child: Node): void {
        super.appendChild(child);

        if (child instanceof WidgetNode) {
            this.attachChildWidget(child);
        }
    }

    public override removeChild(child: Node): void {
        if (child instanceof WidgetNode) {
            this.detachChildWidget(child);
        }

        super.removeChild(child);
    }

    public override insertBefore(child: Node, before: Node): void {
        super.insertBefore(child, before);

        if (child instanceof WidgetNode && before instanceof WidgetNode) {
            if (isReorderable(this.container)) {
                this.insertBeforeReorderable(this.container, child, before);
            } else if (isInsertable(this.container)) {
                this.insertBeforeInsertable(this.container, child, before);
            } else {
                this.attachChildWidget(child);
            }
        } else if (child instanceof WidgetNode) {
            this.attachChildWidget(child);
        }
    }

    public override commitUpdate(oldProps: P | null, newProps: P): void {
        if (!this.container) {
            throw new Error(`WidgetNode.commitUpdate: container is undefined for ${this.typeName}`);
        }

        this.signalStore.blockAll();
        try {
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

                const signalName = propNameToSignalName(name);

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
                const signalName = propNameToSignalName(name);
                const handler = typeof newValue === "function" ? (newValue as SignalHandler) : undefined;
                this.signalStore.set(this, this.container, signalName, handler);
            }

            for (const { name, oldValue, newValue } of pendingProperties) {
                if (name === "text" && oldValue !== undefined && isEditable(this.container)) {
                    if (oldValue !== this.container.getText()) {
                        continue;
                    }
                }

                this.setProperty(name, newValue);
            }
        } finally {
            this.signalStore.unblockAll();
        }
    }

    private attachChildWidget(child: WidgetNode): void {
        const strategy = getAttachmentStrategy(this.container);
        if (!strategy) {
            throw new Error(
                `Cannot append '${child.typeName}' to '${this.container.constructor.name}': container does not support children`,
            );
        }
        if (strategy.type === "appendable" || strategy.type === "addable") {
            detachChildFromParent(child);
        }
        performAttachment(child.container, strategy);
    }

    private detachChildWidget(child: WidgetNode): void {
        const strategy = getAttachmentStrategy(this.container);
        if (!strategy) {
            throw new Error(
                `Cannot remove '${child.typeName}' from '${this.container.constructor.name}': container does not support child removal`,
            );
        }
        performDetachment(child.container, strategy);
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

    private getPropertyDefaultValue(key: string): unknown {
        if (!resolvePropMeta(this.container, key)) return undefined;

        const pspec = findProperty(this.container, key);
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
        if (!setter || typeof setter !== "function") return;

        if (getterName && findProperty(this.container, key) instanceof ParamSpecString) {
            const getter = this.container[getterName as keyof typeof this.container];

            if (getter && typeof getter === "function") {
                const currentValue = getter.call(this.container);
                if (currentValue === value) return;
            }
        }

        setter.call(this.container, value);
    }

    private insertBeforeReorderable(container: ReorderableWidget, child: WidgetNode, before: WidgetNode): void {
        const previousSibling = this.findPreviousSibling(before);
        const currentParent = child.container.getParent();
        const isChildOfThisContainer = currentParent && currentParent === container;

        if (isChildOfThisContainer) {
            container.reorderChildAfter(child.container, previousSibling);
        } else {
            detachChildFromParent(child);
            container.insertChildAfter(child.container, previousSibling);
        }
    }

    private insertBeforeInsertable(container: InsertableWidget, child: WidgetNode, before: WidgetNode): void {
        detachChildFromParent(child);
        const position = this.findInsertPosition(before);
        container.insert(child.container, position);
    }

    private findPreviousSibling(before: WidgetNode): Gtk.Widget | undefined {
        let beforeChild = this.container.getFirstChild();

        while (beforeChild) {
            if (beforeChild === before.container) {
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
            if (currentChild === before.container) {
                return position;
            }
            position++;
            currentChild = currentChild.getNextSibling();
        }

        throw new Error(`Cannot find 'before' child in container`);
    }
}

export function detachChildFromParent(child: WidgetNode): void {
    const currentParent = child.container.getParent();
    if (currentParent !== null && isRemovable(currentParent)) {
        currentParent.remove(child.container);
    }
}

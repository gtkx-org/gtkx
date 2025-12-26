import { getObjectId, NativeObject } from "@gtkx/ffi";
import * as Gtk from "@gtkx/ffi/gtk";
import { CONSTRUCTOR_PROPS, PROPS, SIGNALS } from "../generated/internal.js";
import { Node } from "../node.js";
import { registerNodeClass } from "../registry.js";
import type { Container, ContainerClass, Props } from "../types.js";
import {
    isAppendable,
    isEditable,
    isInsertable,
    isRemovable,
    isReorderable,
    isSingleChild,
} from "./internal/predicates.js";
import type { SignalHandler } from "./internal/signal-store.js";
import { filterProps, isContainerType } from "./internal/utils.js";
import { SlotNode } from "./slot.js";

export class WidgetNode<T extends Gtk.Widget = Gtk.Widget, P extends Props = Props> extends Node<T, P> {
    public static override priority = 3;

    public static override matches(_type: string, containerOrClass?: Container | ContainerClass): boolean {
        return isContainerType(Gtk.Widget, containerOrClass);
    }

    public static override createContainer(props: Props, containerClass: typeof Gtk.Widget): Container | undefined {
        const WidgetClass = containerClass;
        const typeName = WidgetClass.glibTypeName;
        const args = (CONSTRUCTOR_PROPS[typeName] ?? []).map((name) => props[name]);

        return new WidgetClass(...(args as ConstructorParameters<typeof Gtk.Widget>));
    }

    public appendChild(child: Node): void {
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

        if (isAppendable(this.container)) {
            if (isRemovable(this.container) && child.container.getParent() !== null) {
                this.container.remove(child.container);
            }
            this.container.append(child.container);
        } else if (isSingleChild(this.container)) {
            this.container.setChild(child.container);
        } else {
            throw new Error(
                `Cannot append '${child.typeName}' to '${this.container.constructor.name}': container does not support children`,
            );
        }
    }

    public removeChild(child: Node): void {
        if (child instanceof SlotNode) {
            child.setParent(undefined);
            return;
        }

        if (!(child instanceof WidgetNode)) {
            throw new Error(`Cannot remove '${child.typeName}' from 'Widget': expected WidgetNode child`);
        }

        if (child.container instanceof Gtk.Window) {
            throw new Error(`Cannot remove 'Window' from '${this.typeName}': windows must be top-level containers`);
        }

        if (isRemovable(this.container)) {
            this.container.remove(child.container);
        } else if (isSingleChild(this.container)) {
            this.container.setChild(null);
        } else {
            throw new Error(
                `Cannot remove '${child.typeName}' from '${this.container.constructor.name}': container does not support child removal`,
            );
        }
    }

    public insertBefore(child: Node, before: Node): void {
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

        if (isReorderable(this.container)) {
            let beforeChild = this.container.getFirstChild();

            while (beforeChild) {
                if (getObjectId(beforeChild.id) === getObjectId(before.container.id)) {
                    break;
                }

                beforeChild = beforeChild.getNextSibling();
            }

            if (!beforeChild) {
                throw new Error(`Cannot insert '${child.typeName}': 'before' child not found in container`);
            }

            const previousSibling = beforeChild.getPrevSibling() ?? undefined;
            const isExistingChild = child.container.getParent() !== null;

            if (isExistingChild) {
                this.container.reorderChildAfter(child.container, previousSibling);
            } else {
                this.container.insertChildAfter(child.container, previousSibling);
            }
        } else if (isInsertable(this.container)) {
            if (isRemovable(this.container) && child.container.getParent()) {
                this.container.remove(child.container);
            }

            let position = 0;
            let currentChild = this.container.getFirstChild();

            while (currentChild) {
                if (getObjectId(currentChild.id) === getObjectId(before.container.id)) {
                    break;
                }

                position++;
                currentChild = currentChild.getNextSibling();
            }

            if (!currentChild) {
                throw new Error(`Cannot insert '${child.typeName}': 'before' child not found in container`);
            }

            this.container.insert(child.container, position);
        } else {
            this.appendChild(child);
        }
    }

    public updateProps(oldProps: P | null, newProps: P): void {
        const propNames = new Set([
            ...Object.keys(filterProps(oldProps ?? {}, ["children"])),
            ...Object.keys(filterProps(newProps ?? {}, ["children"])),
        ]);

        const WidgetClass = this.container.constructor as typeof Gtk.Widget;
        const signals = SIGNALS[WidgetClass.glibTypeName] || new Set();

        for (const name of propNames) {
            const oldValue = oldProps?.[name];
            const newValue = newProps[name];
            const signalName = this.propNameToSignalName(name);

            if (oldValue === newValue) continue;

            if (signals.has(signalName)) {
                const handler = typeof newValue === "function" ? (newValue as SignalHandler) : undefined;
                this.signalStore.set(this.container, signalName, handler);
            } else if (newValue !== undefined) {
                this.setProperty(name, newValue);
            }
        }
    }

    private propNameToSignalName(name: string): string {
        return name
            .slice(2)
            .replace(/([A-Z])/g, "-$1")
            .toLowerCase()
            .replace(/^-/, "");
    }

    private setProperty(key: string, value: unknown): void {
        const WidgetClass = this.container.constructor as typeof Gtk.Widget;
        const [getterName, setterName] = PROPS[WidgetClass.glibTypeName]?.[key] || [];
        const setter = this.container[setterName as keyof typeof this.container];
        const getter = this.container[getterName as keyof typeof this.container];

        if (getter && typeof getter === "function") {
            const currentValue = getter.call(this.container);

            const isSameObject =
                currentValue instanceof NativeObject &&
                value instanceof NativeObject &&
                getObjectId(currentValue.id) === getObjectId(value.id);

            if (isSameObject || currentValue === value) {
                return;
            }
        }

        if (setter && typeof setter === "function") {
            const editable = isEditable(this.container) ? this.container : null;
            const shouldPreserveCursor = key === "text" && editable !== null;
            const cursorPosition = shouldPreserveCursor ? editable.getPosition() : 0;

            setter.call(this.container, value);

            if (shouldPreserveCursor && editable !== null) {
                const textLength = editable.getText().length;
                editable.setPosition(Math.min(cursorPosition, textLength));
            }
        }
    }
}

registerNodeClass(WidgetNode);

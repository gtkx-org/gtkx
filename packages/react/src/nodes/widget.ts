import { getObjectId } from "@gtkx/ffi";
import * as Gtk from "@gtkx/ffi/gtk";
import { CONSTRUCTOR_PROPS, PROPS, SIGNALS } from "../generated/internal.js";
import { Node } from "../node.js";
import { registerNodeClass } from "../registry.js";
import type { Container, ContainerClass, Props } from "../types.js";
import { filterProps, isContainerType } from "./internal/helpers.js";
import { isAppendable, isRemovable, isReorderable, isSingleChild } from "./internal/predicates.js";
import type { SignalHandler } from "./internal/signal-store.js";
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
            throw new Error(`Cannot append child of type ${child.typeName} to Widget`);
        }

        if (isAppendable(this.container)) {
            this.container.append(child.container);
        } else if (isSingleChild(this.container)) {
            this.container.setChild(child.container);
        } else {
            throw new Error(`Cannot append child to container of type ${this.container.constructor.name}`);
        }
    }

    public removeChild(child: Node): void {
        if (child instanceof SlotNode) {
            child.setParent(undefined);
            return;
        }

        if (!(child instanceof WidgetNode)) {
            throw new Error(`Cannot remove child of type ${child.typeName} from Widget`);
        }

        if (isRemovable(this.container)) {
            this.container.remove(child.container);
        } else if (isSingleChild(this.container)) {
            this.container.setChild(null);
        } else {
            throw new Error(`Cannot remove child from container of type ${this.container.constructor.name}`);
        }
    }

    public insertBefore(child: Node, before: Node): void {
        if (child instanceof SlotNode) {
            child.setParent(this.container);
            return;
        }

        if (!(child instanceof WidgetNode) || !(before instanceof WidgetNode)) {
            throw new Error(`Cannot insert child of type ${child.typeName} before ${before.typeName}`);
        }

        if (isReorderable(this.container)) {
            let afterChild = this.container.getFirstChild();

            while (afterChild) {
                if (getObjectId(afterChild.id) === getObjectId(before.container.id)) {
                    break;
                }

                afterChild = afterChild.getNextSibling();
            }

            if (!afterChild) {
                throw new Error(`The 'before' child is not a child of this container`);
            }

            this.container.insertChildAfter(child.container, afterChild);
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
        const signalUpdates: { name: string; value: unknown }[] = [];
        const propertyUpdates: { name: string; value: unknown }[] = [];

        for (const name of propNames) {
            const oldValue = oldProps?.[name];
            const newValue = newProps[name];

            if (oldValue === newValue) continue;

            if (signals.has(this.propNameToSignalName(name))) {
                signalUpdates.push({ name, value: newValue });
            } else if (newValue !== undefined) {
                propertyUpdates.push({ name, value: newValue });
            }
        }

        for (const { name } of signalUpdates) {
            this.signalStore.disconnect(this.container, this.propNameToSignalName(name));
        }

        if (propertyUpdates.length > 0) {
            this.container.freezeNotify();
        }

        this.signalStore.block(() => {
            for (const { name, value } of propertyUpdates) {
                this.setProperty(name, value);
            }
        });

        if (propertyUpdates.length > 0) {
            this.container.thawNotify();
        }

        for (const { name, value } of signalUpdates) {
            if (typeof value === "function") {
                this.signalStore.connect(this.container, this.propNameToSignalName(name), value as SignalHandler);
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

        if (getter && typeof getter === "function" && getter.call(this.container) === value) {
            return;
        }

        if (setter && typeof setter === "function") {
            setter.call(this.container, value);
        }
    }
}

registerNodeClass(WidgetNode);

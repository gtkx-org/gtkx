import { batch, NativeObject } from "@gtkx/ffi";
import type * as GObject from "@gtkx/ffi/gobject";
import * as Gtk from "@gtkx/ffi/gtk";
import { CONSTRUCTOR_PROPS, PROPS, SIGNALS } from "../generated/internal.js";
import { Node } from "../node.js";
import { registerNodeClass } from "../registry.js";
import type { Container, ContainerClass, Props } from "../types.js";
import {
    hasSingleContent,
    isAddable,
    isAppendable,
    isEditable,
    isInsertable,
    isRemovable,
    isReorderable,
    isSingleChild,
} from "./internal/predicates.js";
import { type SignalHandler, signalStore } from "./internal/signal-store.js";
import { filterProps, isContainerType } from "./internal/utils.js";
import { SlotNode } from "./slot.js";

const EVENT_CONTROLLER_PROPS = new Set([
    "onEnter",
    "onLeave",
    "onMotion",
    "onPressed",
    "onReleased",
    "onKeyPressed",
    "onKeyReleased",
    "onScroll",
    "onNotify",
]);

export class WidgetNode<T extends Gtk.Widget = Gtk.Widget, P extends Props = Props> extends Node<T, P> {
    public static override priority = 3;

    private motionController?: Gtk.EventControllerMotion;
    private clickController?: Gtk.GestureClick;
    private keyController?: Gtk.EventControllerKey;
    private scrollController?: Gtk.EventControllerScroll;

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

        batch(() => {
            if (isAppendable(this.container)) {
                const currentParent = child.container.getParent();

                if (currentParent !== null && isRemovable(currentParent)) {
                    currentParent.remove(child.container);
                }

                this.container.append(child.container);
            } else if (isAddable(this.container)) {
                const currentParent = child.container.getParent();

                if (currentParent !== null && isRemovable(currentParent)) {
                    currentParent.remove(child.container);
                }

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
        });
    }

    public removeChild(child: Node): void {
        if (child instanceof SlotNode) {
            return;
        }

        if (!(child instanceof WidgetNode)) {
            throw new Error(`Cannot remove '${child.typeName}' from 'Widget': expected WidgetNode child`);
        }

        if (child.container instanceof Gtk.Window) {
            throw new Error(`Cannot remove 'Window' from '${this.typeName}': windows must be top-level containers`);
        }

        batch(() => {
            if (isRemovable(this.container)) {
                this.container.remove(child.container);
            } else if (hasSingleContent(this.container)) {
                this.container.setContent(undefined);
            } else if (isSingleChild(this.container)) {
                this.container.setChild(null);
            } else {
                throw new Error(
                    `Cannot remove '${child.typeName}' from '${this.container.constructor.name}': container does not support child removal`,
                );
            }
        });
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

        batch(() => {
            if (isReorderable(this.container)) {
                let beforeChild = this.container.getFirstChild();

                while (beforeChild) {
                    if (beforeChild.equals(before.container)) {
                        break;
                    }

                    beforeChild = beforeChild.getNextSibling();
                }

                if (!beforeChild) {
                    throw new Error(`Cannot insert '${child.typeName}': 'before' child not found in container`);
                }

                const previousSibling = beforeChild.getPrevSibling() ?? undefined;
                const currentParent = child.container.getParent();
                const isChildOfThisContainer = currentParent?.equals(this.container);

                if (isChildOfThisContainer) {
                    this.container.reorderChildAfter(child.container, previousSibling);
                } else {
                    if (currentParent !== null && isRemovable(currentParent)) {
                        currentParent.remove(child.container);
                    }
                    this.container.insertChildAfter(child.container, previousSibling);
                }
            } else if (isInsertable(this.container)) {
                const currentParent = child.container.getParent();
                if (currentParent !== null && isRemovable(currentParent)) {
                    currentParent.remove(child.container);
                }

                let position = 0;
                let currentChild = this.container.getFirstChild();

                while (currentChild) {
                    if (currentChild.equals(before.container)) {
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
        });
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

            if (oldValue === newValue) continue;

            if (EVENT_CONTROLLER_PROPS.has(name)) {
                this.updateEventControllerProp(name, newValue as SignalHandler | undefined);
                continue;
            }

            const signalName = this.propNameToSignalName(name);

            if (signals.has(signalName)) {
                const handler = typeof newValue === "function" ? (newValue as SignalHandler) : undefined;
                signalStore.set(this, this.container, signalName, handler);
            } else if (newValue !== undefined) {
                const expectedValue = this.getProperty(name);
                const isEditableText = name === "text" && isEditable(this.container);

                if (isEditableText && expectedValue !== undefined && expectedValue !== newValue) {
                    continue;
                }

                this.setProperty(name, newValue);
            }
        }
    }

    private updateEventControllerProp(propName: string, handler: SignalHandler | undefined): void {
        switch (propName) {
            case "onEnter":
            case "onLeave":
            case "onMotion": {
                if (!this.motionController) {
                    this.motionController = new Gtk.EventControllerMotion();
                    this.container.addController(this.motionController);
                }
                const signalName = propName === "onEnter" ? "enter" : propName === "onLeave" ? "leave" : "motion";
                signalStore.set(this, this.motionController, signalName, handler);
                break;
            }
            case "onPressed":
            case "onReleased": {
                if (!this.clickController) {
                    this.clickController = new Gtk.GestureClick();
                    this.container.addController(this.clickController);
                }
                const signalName = propName === "onPressed" ? "pressed" : "released";
                signalStore.set(this, this.clickController, signalName, handler);
                break;
            }
            case "onKeyPressed":
            case "onKeyReleased": {
                if (!this.keyController) {
                    this.keyController = new Gtk.EventControllerKey();
                    this.container.addController(this.keyController);
                }
                const signalName = propName === "onKeyPressed" ? "key-pressed" : "key-released";
                signalStore.set(this, this.keyController, signalName, handler);
                break;
            }
            case "onScroll": {
                if (!this.scrollController) {
                    this.scrollController = new Gtk.EventControllerScroll(Gtk.EventControllerScrollFlags.BOTH_AXES);
                    this.container.addController(this.scrollController);
                }
                signalStore.set(this, this.scrollController, "scroll", handler);
                break;
            }
            case "onNotify": {
                const wrappedHandler = handler
                    ? (obj: Gtk.Widget, pspec: GObject.ParamSpec) => {
                          handler(obj, pspec.getName());
                      }
                    : undefined;

                signalStore.set(this, this.container, "notify", wrappedHandler);
                break;
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

    private getProperty(key: string): unknown {
        const WidgetClass = this.container.constructor as typeof Gtk.Widget;
        const [getterName] = PROPS[WidgetClass.glibTypeName]?.[key] || [];
        const getter = getterName ? this.container[getterName as keyof typeof this.container] : undefined;

        if (getter && typeof getter === "function") {
            return getter.call(this.container);
        }

        return undefined;
    }

    private setProperty(key: string, value: unknown): void {
        const WidgetClass = this.container.constructor as typeof Gtk.Widget;
        const [getterName, setterName] = PROPS[WidgetClass.glibTypeName]?.[key] || [];
        const setter = this.container[setterName as keyof typeof this.container];
        const getter = this.container[getterName as keyof typeof this.container];

        if (getter && typeof getter === "function") {
            const currentValue = getter.call(this.container);

            if (currentValue === value) {
                return;
            }

            if (currentValue instanceof NativeObject && currentValue.equals(value)) {
                return;
            }
        }

        if (setter && typeof setter === "function") {
            setter.call(this.container, value);
        }
    }
}

registerNodeClass(WidgetNode);

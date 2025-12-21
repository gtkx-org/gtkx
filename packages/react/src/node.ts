import * as GObject from "@gtkx/ffi/gobject";
import type * as Gtk from "@gtkx/ffi/gtk";
import type { Props, ROOT_NODE_CONTAINER } from "./factory.js";
import { CONSTRUCTOR_PARAMS, PROP_SETTERS, SETTER_GETTERS, SIGNALS } from "./generated/internal.js";
import { NAMESPACE_REGISTRY } from "./generated/registry.js";
import { isAddable, isAppendable, isChildContainer, isRemovable, isSingleChild } from "./predicates.js";

type WidgetConstructor = new (...args: unknown[]) => Gtk.Widget;

export const normalizeWidgetType = (type: string): string => type.split(".")[0] || type;

const resolveWidgetClass = (type: string): WidgetConstructor | undefined => {
    for (const [prefix, namespace] of NAMESPACE_REGISTRY) {
        if (type.startsWith(prefix)) {
            const className = type.slice(prefix.length);
            return namespace[className] as WidgetConstructor | undefined;
        }
    }

    return undefined;
};

const extractConstructorArgs = (type: string, props: Props): unknown[] => {
    const params = CONSTRUCTOR_PARAMS[type];
    if (!params) return [];
    return params.map((p: { name: string; hasDefault: boolean }) => props[p.name]);
};

type NodeClass = typeof Node & { consumedPropNames?: readonly string[] };

export abstract class Node<
    T extends Gtk.Widget | undefined = Gtk.Widget | undefined,
    S extends object | undefined = object | undefined,
> {
    static matches(_type: string, _widget?: Gtk.Widget | typeof ROOT_NODE_CONTAINER): boolean {
        return false;
    }

    static consumedPropNames: readonly string[] = [];

    protected signalHandlers = new Map<string, number>();
    protected widget: T = undefined as T;
    protected widgetType: string;
    protected nodeType: string;
    parent: Node | null = null;
    private _state: S | null = null;

    protected get state(): S {
        if (this._state === null) {
            throw new Error(`${this.constructor.name} not initialized`);
        }
        return this._state;
    }

    protected set state(value: S) {
        this._state = value;
    }

    protected isVirtual(): boolean {
        return false;
    }

    protected isStandalone(): boolean {
        return false;
    }

    constructor(type: string, widget?: Gtk.Widget) {
        this.nodeType = type;
        this.widgetType = normalizeWidgetType(type);

        if (widget) {
            this.widget = widget as T;
        }
    }

    initialize(props: Props): void {
        if (!this.widget && !this.isVirtual()) {
            this.widget = this.createWidget(this.nodeType, props) as T;
        }
        this.updateProps({}, props);
    }

    protected createWidget(type: string, props: Props): T {
        const widgetType = normalizeWidgetType(type);
        const WidgetClass = resolveWidgetClass(widgetType);

        if (!WidgetClass) {
            throw new Error(`Unknown GTK widget type: ${widgetType}`);
        }

        return new WidgetClass(...extractConstructorArgs(widgetType, props)) as T;
    }

    getWidget(): T {
        return this.widget;
    }

    appendChild(child: Node): void {
        child.parent = this;
        const childWidget = child.getWidget();
        if (!childWidget || child.isStandalone()) return;

        if (isChildContainer(this)) {
            this.attachChild(childWidget);
        } else if (this.widget && isAppendable(this.widget)) {
            childWidget.insertBefore(this.widget);
        } else if (this.widget && isAddable(this.widget)) {
            this.widget.add(childWidget);
        } else if (this.widget && isSingleChild(this.widget)) {
            this.widget.setChild(childWidget);
        }
    }

    removeChild(child: Node): void {
        child.unmount();
        const childWidget = child.getWidget();

        if (childWidget) {
            if (isChildContainer(this)) {
                this.detachChild(childWidget);
            } else if (this.widget && isRemovable(this.widget)) {
                this.widget.remove(childWidget);
            } else if (this.widget && isSingleChild(this.widget)) {
                this.widget.setChild(null);
            }
        }

        child.parent = null;
    }

    insertBefore(child: Node, before: Node): void {
        child.parent = this;
        const childWidget = child.getWidget();
        const beforeWidget = before.getWidget();
        if (!childWidget || child.isStandalone()) return;

        if (isChildContainer(this)) {
            if (beforeWidget) {
                this.insertChildBefore(childWidget, beforeWidget);
            } else {
                this.attachChild(childWidget);
            }
        } else if (this.widget && isAppendable(this.widget) && beforeWidget) {
            childWidget.insertBefore(this.widget, beforeWidget);
        } else {
            this.appendChild(child);
        }
    }

    unmount(): void {
        this.disconnectAllSignals();
    }

    protected disconnectAllSignals(): void {
        const widget = this.getWidget();
        if (!widget) return;

        for (const [_eventName, handlerId] of this.signalHandlers) {
            GObject.signalHandlerDisconnect(widget, handlerId);
        }
        this.signalHandlers.clear();
    }

    hasParent(): boolean {
        return this.parent !== null;
    }

    protected consumedProps(): Set<string> {
        const consumed = new Set(["children"]);

        let proto = Object.getPrototypeOf(this) as NodeClass | null;
        while (proto && proto.constructor !== Object) {
            const propNames = (proto.constructor as NodeClass).consumedPropNames;
            if (propNames) {
                for (const name of propNames) {
                    consumed.add(name);
                }
            }
            proto = Object.getPrototypeOf(proto) as NodeClass | null;
        }

        return consumed;
    }

    updateProps(oldProps: Props, newProps: Props): void {
        const widget = this.getWidget();

        if (!widget) return;

        const consumed = this.consumedProps();
        const allKeys = new Set([...Object.keys(oldProps), ...Object.keys(newProps)]);
        const widgetSignals = SIGNALS[this.widgetType];

        const signalUpdates: { key: string; newValue: unknown }[] = [];
        const propertyUpdates: { key: string; newValue: unknown }[] = [];

        for (const key of allKeys) {
            if (consumed.has(key)) continue;

            const oldValue = oldProps[key];
            const newValue = newProps[key];

            if (oldValue === newValue) continue;

            const isSignal = widgetSignals?.has(this.propKeyToEventName(key)) ?? false;

            if (isSignal) {
                signalUpdates.push({ key, newValue });
            } else if (newValue !== undefined) {
                propertyUpdates.push({ key, newValue });
            }
        }

        for (const { key } of signalUpdates) {
            this.disconnectSignal(this.propKeyToEventName(key));
        }

        if (propertyUpdates.length > 0) {
            widget.freezeNotify();
        }

        for (const { key, newValue } of propertyUpdates) {
            this.setProperty(widget, key, newValue);
        }

        if (propertyUpdates.length > 0) {
            widget.thawNotify();
        }

        for (const { key, newValue } of signalUpdates) {
            if (typeof newValue === "function") {
                this.connectSignal(widget, this.propKeyToEventName(key), newValue as (...args: unknown[]) => unknown);
            }
        }
    }

    protected propKeyToEventName(key: string): string {
        return key
            .slice(2)
            .replace(/([A-Z])/g, "-$1")
            .toLowerCase()
            .replace(/^-/, "");
    }

    protected disconnectSignal(eventName: string): void {
        const handlerId = this.signalHandlers.get(eventName);

        if (handlerId !== undefined) {
            const widget = this.getWidget();
            if (widget) {
                GObject.signalHandlerDisconnect(widget, handlerId);
            }
            this.signalHandlers.delete(eventName);
        }
    }

    protected connectSignal(widget: Gtk.Widget, eventName: string, handler: (...args: unknown[]) => unknown): void {
        const handlerId = widget.connect(eventName, handler);
        this.signalHandlers.set(eventName, handlerId);
    }

    protected setProperty(widget: Gtk.Widget, key: string, value: unknown): void {
        const setterName = PROP_SETTERS[this.widgetType]?.[key];
        if (!setterName) return;

        const setter = widget[setterName as keyof typeof widget];
        if (typeof setter !== "function") return;

        const getterName = SETTER_GETTERS[this.widgetType]?.[setterName];
        if (getterName) {
            const getter = widget[getterName as keyof typeof widget];
            if (typeof getter === "function") {
                const currentValue = (getter as () => unknown).call(widget);
                if (currentValue === value) return;
            }
        }

        (setter as (value: unknown) => void).call(widget, value);
    }

    mount(): void {}
}

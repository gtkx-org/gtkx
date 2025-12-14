import * as Adw from "@gtkx/ffi/adw";
import * as GObject from "@gtkx/ffi/gobject";
import * as Gtk from "@gtkx/ffi/gtk";
import * as GtkSource from "@gtkx/ffi/gtksource";
import * as Vte from "@gtkx/ffi/vte";
import * as WebKit from "@gtkx/ffi/webkit";
import type { Props, ROOT_NODE_CONTAINER } from "./factory.js";
import { CONSTRUCTOR_PARAMS, PROP_SETTERS, SETTER_GETTERS } from "./generated/internal.js";
import { isAddable, isAppendable, isRemovable, isSingleChild } from "./predicates.js";

type WidgetConstructor = new (...args: unknown[]) => Gtk.Widget;
type Namespace = Record<string, unknown>;

const NAMESPACE_REGISTRY: [string, Namespace][] = [
    ["GtkSource", GtkSource],
    ["WebKit", WebKit],
    ["Adw", Adw],
    ["Vte", Vte],
];

const resolveWidgetClass = (type: string): WidgetConstructor | undefined => {
    for (const [prefix, namespace] of NAMESPACE_REGISTRY) {
        if (type.startsWith(prefix)) {
            const className = type.slice(prefix.length);
            return namespace[className] as WidgetConstructor | undefined;
        }
    }

    // biome-ignore lint/performance/noDynamicNamespaceImportAccess: dynamic widget resolution by name
    return Gtk[type as keyof typeof Gtk] as WidgetConstructor | undefined;
};

const extractConstructorArgs = (type: string, props: Props): unknown[] => {
    const params = CONSTRUCTOR_PARAMS[type];
    if (!params) return [];
    return params.map((p: { name: string; hasDefault: boolean }) => props[p.name]);
};

export abstract class Node<
    T extends Gtk.Widget | undefined = Gtk.Widget | undefined,
    S extends object | undefined = object | undefined,
> {
    static matches(_type: string, _existingWidget?: Gtk.Widget | typeof ROOT_NODE_CONTAINER): boolean {
        return false;
    }

    protected signalHandlers = new Map<string, number>();
    protected widget: T = undefined as T;
    protected widgetType: string;
    protected nodeType: string;
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

    constructor(type: string, existingWidget?: Gtk.Widget) {
        this.nodeType = type;
        this.widgetType = type.split(".")[0] || type;

        if (existingWidget) {
            this.widget = existingWidget as T;
        }
    }

    /**
     * Initializes the node with props. Called by the reconciler after construction.
     * Subclasses can override to perform custom initialization.
     */
    initialize(props: Props): void {
        if (!this.widget && !this.isVirtual()) {
            this.widget = this.createWidget(this.nodeType, props) as T;
        }
        this.updateProps({}, props);
    }

    protected createWidget(type: string, props: Props): T {
        const normalizedType = type.split(".")[0] || type;
        const WidgetClass = resolveWidgetClass(normalizedType);

        if (!WidgetClass) {
            throw new Error(`Unknown GTK widget type: ${normalizedType}`);
        }

        return new WidgetClass(...extractConstructorArgs(normalizedType, props)) as T;
    }

    getWidget(): T {
        return this.widget;
    }

    appendChild(child: Node): void {
        child.attachToParent(this);
    }

    removeChild(child: Node): void {
        child.detachFromParent(this);
    }

    insertBefore(child: Node, before: Node): void {
        child.attachToParentBefore(this, before);
    }

    attachToParent(parent: Node): void {
        const parentWidget = parent.getWidget();
        const widget = this.getWidget();

        if (!parentWidget || !widget) return;

        if (isAppendable(parentWidget)) {
            widget.insertBefore(parentWidget, null);
        } else if (isAddable(parentWidget)) {
            parentWidget.add(widget);
        } else if (isSingleChild(parentWidget)) {
            parentWidget.setChild(widget);
        }
    }

    detachFromParent(parent: Node): void {
        const parentWidget = parent.getWidget();
        const widget = this.getWidget();

        if (!parentWidget || !widget) return;

        if (isRemovable(parentWidget)) {
            parentWidget.remove(widget);
        } else if (isSingleChild(parentWidget)) {
            parentWidget.setChild(null);
        }
    }

    attachToParentBefore(parent: Node, before: Node): void {
        const parentWidget = parent.getWidget();
        const widget = this.getWidget();
        const beforeWidget = before.getWidget();

        if (!parentWidget || !widget) return;

        if (isAppendable(parentWidget) && beforeWidget) {
            widget.insertBefore(parentWidget, beforeWidget);
        } else {
            this.attachToParent(parent);
        }
    }

    protected consumedProps(): Set<string> {
        return new Set(["children"]);
    }

    updateProps(oldProps: Props, newProps: Props): void {
        const widget = this.getWidget();

        if (!widget) return;

        const consumed = this.consumedProps();
        const allKeys = new Set([...Object.keys(oldProps), ...Object.keys(newProps)]);

        const signalUpdates: { key: string; newValue: unknown }[] = [];
        const propertyUpdates: { key: string; newValue: unknown }[] = [];

        for (const key of allKeys) {
            if (consumed.has(key)) continue;

            const oldValue = oldProps[key];
            const newValue = newProps[key];

            if (oldValue === newValue) continue;

            if (key.startsWith("on")) {
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

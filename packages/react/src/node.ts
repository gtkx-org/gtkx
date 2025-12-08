import { getCurrentApp } from "@gtkx/ffi";
import * as GObject from "@gtkx/ffi/gobject";
import * as Gtk from "@gtkx/ffi/gtk";
import type { Props, ROOT_NODE_CONTAINER } from "./factory.js";
import { CONSTRUCTOR_PARAMS, PROP_SETTERS, SETTER_GETTERS } from "./generated/jsx.js";
import { isAppendable, isRemovable, isSingleChild } from "./predicates.js";

type WidgetConstructor = new (...args: unknown[]) => Gtk.Widget;

const extractConstructorArgs = (type: string, props: Props): unknown[] => {
    const params = CONSTRUCTOR_PARAMS[type];
    if (!params) return [];
    return params.map((p: { name: string; hasDefault: boolean }) => props[p.name]);
};

export abstract class Node<T extends Gtk.Widget | undefined = Gtk.Widget | undefined> {
    static matches(_type: string, _existingWidget?: Gtk.Widget | typeof ROOT_NODE_CONTAINER): boolean {
        return false;
    }

    protected signalHandlers = new Map<string, number>();
    protected widget: T;
    protected widgetType: string;

    protected isVirtual(): boolean {
        return false;
    }

    constructor(type: string, props: Props, existingWidget?: Gtk.Widget) {
        this.widgetType = type.split(".")[0] || type;

        if (existingWidget) {
            this.widget = existingWidget as T;
            return;
        }

        this.widget = (this.isVirtual() ? undefined : this.createWidget(type, props)) as T;
        this.updateProps({}, props);
    }

    protected createWidget(type: string, props: Props): T {
        const normalizedType = type.split(".")[0] || type;
        // biome-ignore lint/performance/noDynamicNamespaceImportAccess: dynamic widget creation
        const WidgetClass = Gtk[normalizedType as keyof typeof Gtk] as WidgetConstructor | undefined;

        if (!WidgetClass) {
            throw new Error(`Unknown GTK widget type: ${normalizedType}`);
        }

        if (WidgetClass === Gtk.ApplicationWindow) {
            return new WidgetClass(getCurrentApp()) as T;
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

        for (const { key, newValue } of propertyUpdates) {
            this.setProperty(widget, key, newValue);
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

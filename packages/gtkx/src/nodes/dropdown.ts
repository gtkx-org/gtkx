import * as gtk from "@gtkx/ffi/gtk";
import type { Props } from "../factory.js";
import type { Node } from "../node.js";

type ItemLabelFn<T> = (item: T) => string;

class DropDownStore<T> {
    private stringList: gtk.StringList;
    private items: T[] = [];
    private labelFn: ItemLabelFn<T>;

    constructor(labelFn: ItemLabelFn<T>) {
        this.stringList = new gtk.StringList([]);
        this.labelFn = labelFn;
    }

    getModel(): unknown {
        return this.stringList.ptr;
    }

    append(item: T): void {
        const label = this.labelFn(item);
        this.stringList.append(label);
        this.items.push(item);
    }

    remove(item: T): void {
        const index = this.items.indexOf(item);
        if (index !== -1) {
            this.stringList.remove(index);
            this.items.splice(index, 1);
        }
    }

    getItem(index: number): T | undefined {
        return this.items[index];
    }

    get length(): number {
        return this.items.length;
    }
}

const dropdownStores = new WeakMap<gtk.Widget, DropDownStore<unknown>>();

const getOrCreateStore = <T>(widget: gtk.Widget, labelFn: ItemLabelFn<T>): DropDownStore<T> => {
    let store = dropdownStores.get(widget) as DropDownStore<T> | undefined;
    if (!store) {
        store = new DropDownStore<T>(labelFn);
        dropdownStores.set(widget, store as DropDownStore<unknown>);

        if ("setModel" in widget && typeof widget.setModel === "function") {
            (widget.setModel as (model: unknown) => void)(store.getModel());
        }
    }
    return store;
};

export class DropDownNode implements Node {
    static needsWidget = true;

    static matches(type: string): boolean {
        return type === "DropDown" || type === "DropDown.Root";
    }

    private widget: gtk.Widget;
    private labelFn: ItemLabelFn<unknown>;
    private onSelectionChanged?: (item: unknown, index: number) => void;

    constructor(_type: string, widget: gtk.Widget, props: Props) {
        this.widget = widget;
        this.labelFn = (props.itemLabel as ItemLabelFn<unknown>) ?? ((item: unknown) => String(item));
        this.onSelectionChanged = props.onSelectionChanged as ((item: unknown, index: number) => void) | undefined;

        getOrCreateStore(widget, this.labelFn);

        if (this.onSelectionChanged && "connect" in widget && typeof widget.connect === "function") {
            const handler = () => {
                if ("getSelected" in widget && typeof widget.getSelected === "function") {
                    const index = (widget.getSelected as () => number)();
                    const store = dropdownStores.get(widget);
                    const item = store?.getItem(index);
                    this.onSelectionChanged?.(item, index);
                }
            };
            widget.connect("notify::selected", handler);
        }
    }

    getWidget(): gtk.Widget {
        return this.widget;
    }

    getLabelFn(): ItemLabelFn<unknown> {
        return this.labelFn;
    }

    appendChild(child: Node): void {
        child.attachToParent(this);
    }

    removeChild(child: Node): void {
        child.detachFromParent(this);
    }

    insertBefore(child: Node, _before: Node): void {
        this.appendChild(child);
    }

    attachToParent(parent: Node): void {
        const parentWidget = parent.getWidget?.();
        if (!parentWidget) return;

        if ("setChild" in parentWidget && typeof parentWidget.setChild === "function") {
            (parentWidget.setChild as (ptr: unknown) => void)(this.widget.ptr);
        } else if ("append" in parentWidget && typeof parentWidget.append === "function") {
            (parentWidget.append as (ptr: unknown) => void)(this.widget.ptr);
        }
    }

    detachFromParent(parent: Node): void {
        const parentWidget = parent.getWidget?.();
        if (!parentWidget) return;

        if ("remove" in parentWidget && typeof parentWidget.remove === "function") {
            (parentWidget.remove as (ptr: unknown) => void)(this.widget.ptr);
        }
    }

    updateProps(oldProps: Props, newProps: Props): void {
        if (oldProps.onSelectionChanged !== newProps.onSelectionChanged) {
            this.onSelectionChanged = newProps.onSelectionChanged as
                | ((item: unknown, index: number) => void)
                | undefined;
        }

        const consumedProps = new Set(["children", "itemLabel", "onSelectionChanged"]);
        const allKeys = new Set([...Object.keys(oldProps), ...Object.keys(newProps)]);

        for (const key of allKeys) {
            if (consumedProps.has(key)) continue;

            const oldValue = oldProps[key];
            const newValue = newProps[key];

            if (oldValue === newValue) continue;

            if (key.startsWith("on")) {
                continue;
            }

            const setterName = `set${key.charAt(0).toUpperCase()}${key.slice(1)}`;
            const setter = this.widget[setterName as keyof typeof this.widget];
            if (typeof setter === "function") {
                (setter as (value: unknown) => void).call(this.widget, newValue);
            }
        }
    }

    mount(): void {}
}

export class DropDownItemNode<T = unknown> implements Node {
    static needsWidget = false;

    static matches(type: string): boolean {
        return type === "DropDown.Item";
    }

    private item: T;

    constructor(_type: string, _widget: gtk.Widget, props: Props) {
        this.item = props.item as T;
    }

    getItem(): T {
        return this.item;
    }

    appendChild(_child: Node): void {}

    removeChild(_child: Node): void {}

    insertBefore(_child: Node, _before: Node): void {}

    attachToParent(parent: Node): void {
        const widget = parent.getWidget?.();
        if (!widget) return;

        const labelFn = (parent as DropDownNode).getLabelFn?.() ?? ((item: unknown) => String(item));
        const store = getOrCreateStore(widget, labelFn);
        store.append(this.item);
    }

    detachFromParent(parent: Node): void {
        const widget = parent.getWidget?.();
        if (!widget) return;

        const store = dropdownStores.get(widget);
        if (store) {
            store.remove(this.item);
        }
    }

    updateProps(_oldProps: Props, _newProps: Props): void {}

    mount(): void {}
}

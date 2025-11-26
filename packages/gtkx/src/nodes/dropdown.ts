import * as gtk from "@gtkx/ffi/gtk";
import type { Props } from "../factory.js";
import type { Node } from "../node.js";
import {
    appendChild,
    type Connectable,
    disconnectSignalHandlers,
    isConnectable,
    isModelSettable,
    isSelectable,
    type ModelSettable,
    removeChild,
    type Selectable,
} from "../widget-capabilities.js";

type ItemLabelFn<T> = (item: T) => string;

interface DropDownWidget extends gtk.Widget, ModelSettable, Selectable, Connectable {}

const isDropDownWidget = (widget: gtk.Widget): widget is DropDownWidget =>
    isModelSettable(widget) && isSelectable(widget) && isConnectable(widget);

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

const getOrCreateStore = <T>(widget: DropDownWidget, labelFn: ItemLabelFn<T>): DropDownStore<T> => {
    let store = dropdownStores.get(widget) as DropDownStore<T> | undefined;
    if (!store) {
        store = new DropDownStore<T>(labelFn);
        dropdownStores.set(widget, store as DropDownStore<unknown>);
        widget.setModel(store.getModel());
    }
    return store;
};

/**
 * Node implementation for GTK DropDown widgets.
 * Manages item model and selection change events.
 */
export class DropDownNode implements Node<DropDownWidget> {
    static needsWidget = true;

    static matches(type: string, widget: gtk.Widget | null): widget is DropDownWidget {
        if (type !== "DropDown" && type !== "DropDown.Root") return false;
        return widget !== null && isDropDownWidget(widget);
    }

    private widget: DropDownWidget;
    private labelFn: ItemLabelFn<unknown>;
    private onSelectionChanged?: (item: unknown, index: number) => void;
    private signalHandlers = new Map<string, number>();

    constructor(_type: string, widget: gtk.Widget, props: Props) {
        if (!isDropDownWidget(widget)) {
            throw new Error("DropDownNode requires a DropDown widget");
        }
        this.widget = widget;
        this.labelFn = (props.itemLabel as ItemLabelFn<unknown>) ?? ((item: unknown) => String(item));
        this.onSelectionChanged = props.onSelectionChanged as ((item: unknown, index: number) => void) | undefined;

        getOrCreateStore(this.widget, this.labelFn);

        if (this.onSelectionChanged) {
            const handler = () => {
                const index = this.widget.getSelected();
                const store = dropdownStores.get(this.widget);
                const item = store?.getItem(index);
                this.onSelectionChanged?.(item, index);
            };
            const handlerId = this.widget.connect("notify::selected", handler);
            this.signalHandlers.set("notify::selected", handlerId);
        }
    }

    getWidget(): DropDownWidget {
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
        if (parentWidget) {
            appendChild(parentWidget, this.widget);
        }
    }

    detachFromParent(parent: Node): void {
        const parentWidget = parent.getWidget?.();
        if (parentWidget) {
            removeChild(parentWidget, this.widget);
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

    dispose(): void {
        disconnectSignalHandlers(this.widget, this.signalHandlers);
    }
}

/**
 * Node implementation for DropDown items.
 * Represents individual items in a DropDown widget.
 */
export class DropDownItemNode<T = unknown> implements Node {
    static needsWidget = false;

    static matches(type: string, _widget: gtk.Widget | null): _widget is gtk.Widget {
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
        if (!(parent instanceof DropDownNode)) return;

        const widget = parent.getWidget();
        const labelFn = parent.getLabelFn() ?? ((item: unknown) => String(item));
        const store = getOrCreateStore(widget, labelFn);
        store.append(this.item);
    }

    detachFromParent(parent: Node): void {
        if (!(parent instanceof DropDownNode)) return;

        const widget = parent.getWidget();
        const store = dropdownStores.get(widget);
        if (store) {
            store.remove(this.item);
        }
    }

    updateProps(_oldProps: Props, _newProps: Props): void {}

    mount(): void {}
}

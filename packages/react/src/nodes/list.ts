import * as Gtk from "@gtkx/ffi/gtk";
import type { Props } from "../factory.js";
import type { Node } from "../node.js";
import { appendChild, disconnectSignalHandlers, isConnectable, removeChild } from "../widget-capabilities.js";

type RenderItemFn<T> = (item: T | null) => Gtk.Widget;

interface ListViewWidget extends Gtk.Widget {
    setModel(model: unknown): void;
    setFactory(factory: unknown): void;
}

const isListViewWidget = (widget: Gtk.Widget): widget is ListViewWidget =>
    "setModel" in widget &&
    typeof widget.setModel === "function" &&
    "setFactory" in widget &&
    typeof widget.setFactory === "function";

const LIST_VIEW_TYPES = ["ListView", "ListView.Root"];

export class ListViewNode<T = unknown> implements Node<ListViewWidget> {
    static needsWidget = true;

    static matches(type: string, widget: Gtk.Widget | null): widget is ListViewWidget {
        if (!LIST_VIEW_TYPES.includes(type) && !type.startsWith("ListView")) return false;
        return widget !== null && isListViewWidget(widget);
    }

    private widget: ListViewWidget;
    private stringList: Gtk.StringList;
    private selectionModel: Gtk.SingleSelection;
    private factory: Gtk.SignalListItemFactory;
    private items: T[] = [];
    private renderItem: RenderItemFn<T> | null = null;
    private signalHandlers = new Map<string, number>();
    private factorySignalHandlers = new Map<string, number>();

    constructor(_type: string, widget: Gtk.Widget, props: Props) {
        if (!isListViewWidget(widget)) {
            throw new Error("ListViewNode requires a ListView widget");
        }
        this.widget = widget;

        this.stringList = new Gtk.StringList([]);
        this.selectionModel = new Gtk.SingleSelection(this.stringList);
        this.factory = new Gtk.SignalListItemFactory();

        this.renderItem = props.renderItem as RenderItemFn<T> | null;

        const setupHandlerId = this.factory.connect("setup", (listItemPtr: unknown) => {
            const listItem = Object.create(Gtk.ListItem.prototype) as Gtk.ListItem;
            listItem.ptr = listItemPtr;

            if (this.renderItem) {
                const widget = this.renderItem(null);
                listItem.setChild(widget);
            }
        });
        this.factorySignalHandlers.set("setup", setupHandlerId);

        const bindHandlerId = this.factory.connect("bind", (listItemPtr: unknown) => {
            const listItem = Object.create(Gtk.ListItem.prototype) as Gtk.ListItem;
            listItem.ptr = listItemPtr;

            const position = listItem.getPosition();
            const item = this.items[position];

            if (this.renderItem && item !== undefined) {
                const widget = this.renderItem(item);
                listItem.setChild(widget);
            }
        });
        this.factorySignalHandlers.set("bind", bindHandlerId);

        this.widget.setModel(this.selectionModel.ptr);
        this.widget.setFactory(this.factory.ptr);
    }

    getWidget(): ListViewWidget {
        return this.widget;
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

    addItem(item: T): void {
        this.items.push(item);
        this.stringList.append("");
    }

    removeItem(item: T): void {
        const index = this.items.indexOf(item);
        if (index !== -1) {
            this.items.splice(index, 1);
            this.stringList.remove(index);
        }
    }

    updateProps(oldProps: Props, newProps: Props): void {
        if (oldProps.renderItem !== newProps.renderItem) {
            this.renderItem = newProps.renderItem as RenderItemFn<T> | null;
        }

        const consumedProps = new Set(["children", "renderItem"]);
        const allKeys = new Set([...Object.keys(oldProps), ...Object.keys(newProps)]);

        for (const key of allKeys) {
            if (consumedProps.has(key)) continue;

            const oldValue = oldProps[key];
            const newValue = newProps[key];

            if (oldValue === newValue) continue;

            if (key.startsWith("on")) {
                const eventName = key
                    .slice(2)
                    .replace(/([A-Z])/g, "-$1")
                    .toLowerCase()
                    .replace(/^-/, "");

                const oldHandlerId = this.signalHandlers.get(eventName);
                if (oldHandlerId !== undefined && isConnectable(this.widget)) {
                    this.signalHandlers.delete(eventName);
                }

                if (typeof newValue === "function" && isConnectable(this.widget)) {
                    const handlerId = this.widget.connect(eventName, newValue as (...args: unknown[]) => void);
                    this.signalHandlers.set(eventName, handlerId);
                }
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
        disconnectSignalHandlers(this.factory, this.factorySignalHandlers);
    }
}

const LIST_WIDGETS = ["ListView", "ColumnView", "GridView"];

export class ListItemNode<T = unknown> implements Node {
    static needsWidget = false;

    static matches(type: string, _widget: Gtk.Widget | null): _widget is Gtk.Widget {
        const dotIndex = type.indexOf(".");
        if (dotIndex === -1) return false;
        const widgetType = type.slice(0, dotIndex);
        const suffix = type.slice(dotIndex + 1);
        return suffix === "Item" && LIST_WIDGETS.includes(widgetType);
    }

    private item: T;

    constructor(_type: string, _widget: Gtk.Widget, props: Props) {
        this.item = props.item as T;
    }

    getItem(): T {
        return this.item;
    }

    appendChild(_child: Node): void {}

    removeChild(_child: Node): void {}

    insertBefore(_child: Node, _before: Node): void {}

    attachToParent(parent: Node): void {
        if (parent instanceof ListViewNode) {
            parent.addItem(this.item);
        }
    }

    detachFromParent(parent: Node): void {
        if (parent instanceof ListViewNode) {
            parent.removeItem(this.item);
        }
    }

    updateProps(_oldProps: Props, _newProps: Props): void {}

    mount(): void {}
}

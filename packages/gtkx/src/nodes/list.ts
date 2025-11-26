import * as gtk from "@gtkx/ffi/gtk";
import type { Props } from "../factory.js";
import type { Node } from "../node.js";

/** Internal store for managing list items with GTK StringList. */
class StringListStore<T> {
    private store: gtk.StringList;
    private itemMap = new Map<string, T>();
    private itemList: T[] = [];
    private idCounter = 0;

    constructor() {
        this.store = new gtk.StringList([]);
    }

    private generateId(): string {
        return `item_${this.idCounter++}`;
    }

    append(item: T): void {
        const id = this.generateId();
        this.itemMap.set(id, item);
        this.store.append(id);
        this.itemList.push(item);
    }

    remove(position: number): void {
        const id = this.store.getString(position);
        this.itemMap.delete(id);
        this.store.remove(position);
        this.itemList.splice(position, 1);
    }

    findItem(item: T): number {
        return this.itemList.indexOf(item);
    }

    get length(): number {
        return this.itemList.length;
    }
}

const listStores = new WeakMap<gtk.Widget, StringListStore<unknown>>();

const getOrCreateListStore = <T>(widget: gtk.Widget): StringListStore<T> => {
    let store = listStores.get(widget) as StringListStore<T> | undefined;
    if (!store) {
        store = new StringListStore<T>();
        listStores.set(widget, store as StringListStore<unknown>);
    }
    return store;
};

const addItemToList = <T>(widget: gtk.Widget, item: T): void => {
    const store = getOrCreateListStore<T>(widget);
    store.append(item);
};

const removeItemFromList = <T>(widget: gtk.Widget, item: T): void => {
    const store = listStores.get(widget) as StringListStore<T> | undefined;
    if (store) {
        const position = store.findItem(item);
        if (position !== -1) {
            store.remove(position);
        }
    }
};

const LIST_WIDGETS = ["ListView", "ColumnView", "GridView"];

/**
 * Node implementation for list widget items.
 * Represents individual items in ListView, ColumnView, or GridView.
 */
export class ListItemNode<T = unknown> implements Node {
    /** Whether this node class requires a GTK widget to be created. */
    static needsWidget = false;

    /**
     * Checks if this node class handles the given element type.
     * @param type - The element type to check
     * @returns True if this is a list item type (e.g., "ListView.Item")
     */
    static matches(type: string): boolean {
        const dotIndex = type.indexOf(".");
        if (dotIndex === -1) return false;
        const widgetType = type.slice(0, dotIndex);
        const suffix = type.slice(dotIndex + 1);
        return suffix === "Item" && LIST_WIDGETS.includes(widgetType);
    }

    private item: T;

    /**
     * Creates a new list item node.
     * @param _type - The element type (unused)
     * @param _widget - Unused (items don't create widgets)
     * @param props - Props containing the item data
     */
    constructor(_type: string, _widget: gtk.Widget, props: Props) {
        this.item = props.item as T;
    }

    /**
     * Gets the item data for this list item.
     * @returns The item data
     */
    getItem(): T {
        return this.item;
    }

    appendChild(_child: Node): void {}

    removeChild(_child: Node): void {}

    insertBefore(_child: Node, _before: Node): void {}

    attachToParent(parent: Node): void {
        const widget = parent.getWidget?.();
        if (widget) {
            addItemToList(widget, this.item);
        }
    }

    detachFromParent(parent: Node): void {
        const widget = parent.getWidget?.();
        if (widget) {
            removeItemFromList(widget, this.item);
        }
    }

    updateProps(_oldProps: Props, _newProps: Props): void {}

    mount(): void {}
}

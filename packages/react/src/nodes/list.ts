import { getObject, getObjectId } from "@gtkx/ffi";
import type * as Gio from "@gtkx/ffi/gio";
import * as Gtk from "@gtkx/ffi/gtk";
import type Reconciler from "react-reconciler";
import { scheduleFlush } from "../batch.js";
import { type ItemContainer, isItemContainer } from "../container-interfaces.js";
import type { Props } from "../factory.js";
import { createFiberRoot } from "../fiber-root.js";
import { Node } from "../node.js";
import { reconciler } from "../reconciler.js";
import type { RenderItemFn } from "../types.js";

interface ListItemInfo {
    box: Gtk.Box;
    fiberRoot: Reconciler.FiberRoot;
}

export class ListViewNode extends Node<Gtk.ListView | Gtk.GridView> implements ItemContainer<unknown> {
    static matches(type: string): boolean {
        return type === "ListView.Root" || type === "GridView.Root";
    }

    private stringList: Gtk.StringList;
    private selectionModel: Gtk.SingleSelection;
    private factory: Gtk.SignalListItemFactory;
    private items: unknown[] = [];
    private renderItem: RenderItemFn<unknown>;
    private listItemCache = new Map<number, ListItemInfo>();
    private committedLength = 0;

    constructor(type: string, props: Props) {
        super(type, props);

        this.stringList = new Gtk.StringList([]);
        this.selectionModel = new Gtk.SingleSelection(this.stringList as unknown as Gio.ListModel);
        this.factory = new Gtk.SignalListItemFactory();

        this.renderItem = props.renderItem as RenderItemFn<unknown>;

        this.factory.connect("setup", (_self, listItemObj) => {
            const listItem = getObject(listItemObj.ptr, Gtk.ListItem);
            const id = getObjectId(listItemObj.ptr);

            const box = new Gtk.Box(Gtk.Orientation.VERTICAL, 0);
            listItem.setChild(box);

            const fiberRoot = createFiberRoot(box);
            this.listItemCache.set(id, { box, fiberRoot });

            const element = this.renderItem(null);
            reconciler.getInstance().updateContainer(element, fiberRoot, null, () => {});
        });

        this.factory.connect("bind", (_self, listItemObj) => {
            const listItem = getObject(listItemObj.ptr, Gtk.ListItem);
            const id = getObjectId(listItemObj.ptr);
            const info = this.listItemCache.get(id);

            if (!info) return;

            const position = listItem.getPosition();
            const item = this.items[position];
            const element = this.renderItem(item);
            reconciler.getInstance().updateContainer(element, info.fiberRoot, null, () => {});
        });

        this.factory.connect("unbind", (_self, listItemObj) => {
            const id = getObjectId(listItemObj.ptr);
            const info = this.listItemCache.get(id);

            if (!info) return;

            reconciler.getInstance().updateContainer(null, info.fiberRoot, null, () => {});
        });

        this.factory.connect("teardown", (_self, listItemObj) => {
            const id = getObjectId(listItemObj.ptr);
            const info = this.listItemCache.get(id);

            if (info) {
                reconciler.getInstance().updateContainer(null, info.fiberRoot, null, () => {});
                this.listItemCache.delete(id);
            }
        });

        this.widget.setModel(this.selectionModel);
        this.widget.setFactory(this.factory);
    }

    private syncStringList = (): void => {
        const newLength = this.items.length;
        if (newLength === this.committedLength) return;

        const placeholders = Array.from({ length: newLength }, () => "");
        this.stringList.splice(0, this.committedLength, placeholders);
        this.committedLength = newLength;
    };

    addItem(item: unknown): void {
        this.items.push(item);
        scheduleFlush(this.syncStringList);
    }

    insertItemBefore(item: unknown, beforeItem: unknown): void {
        const beforeIndex = this.items.indexOf(beforeItem);

        if (beforeIndex === -1) {
            this.items.push(item);
        } else {
            this.items.splice(beforeIndex, 0, item);
        }

        scheduleFlush(this.syncStringList);
    }

    removeItem(item: unknown): void {
        const index = this.items.indexOf(item);

        if (index !== -1) {
            this.items.splice(index, 1);
            scheduleFlush(this.syncStringList);
        }
    }

    protected override consumedProps(): Set<string> {
        const consumed = super.consumedProps();
        consumed.add("renderItem");
        return consumed;
    }

    override updateProps(oldProps: Props, newProps: Props): void {
        if (oldProps.renderItem !== newProps.renderItem) {
            this.renderItem = newProps.renderItem as RenderItemFn<unknown>;
        }

        super.updateProps(oldProps, newProps);
    }
}

export class ListItemNode extends Node {
    static matches(type: string): boolean {
        return type === "ListView.Item" || type === "GridView.Item";
    }

    protected override isVirtual(): boolean {
        return true;
    }

    private item: unknown;

    constructor(type: string, props: Props) {
        super(type, props);
        this.item = props.item as unknown;
    }

    getItem(): unknown {
        return this.item;
    }

    override attachToParent(parent: Node): void {
        if (isItemContainer(parent)) {
            parent.addItem(this.item);
        }
    }

    override attachToParentBefore(parent: Node, before: Node): void {
        if (isItemContainer(parent) && before instanceof ListItemNode) {
            parent.insertItemBefore(this.item, before.getItem());
        } else {
            this.attachToParent(parent);
        }
    }

    override detachFromParent(parent: Node): void {
        if (isItemContainer(parent)) {
            parent.removeItem(this.item);
        }
    }
}

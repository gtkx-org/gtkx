import { getInterface, getObject, getObjectId } from "@gtkx/ffi";
import * as Gio from "@gtkx/ffi/gio";
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

interface ListViewState {
    stringList: Gtk.StringList;
    selectionModel: Gtk.SingleSelection;
    factory: Gtk.SignalListItemFactory;
    renderItem: RenderItemFn<unknown>;
    listItemCache: Map<number, ListItemInfo>;
    items: unknown[];
    committedLength: number;
}

export class ListViewNode extends Node<Gtk.ListView | Gtk.GridView, ListViewState> implements ItemContainer<unknown> {
    static matches(type: string): boolean {
        return type === "ListView.Root" || type === "GridView.Root";
    }

    override initialize(props: Props): void {
        // State must be initialized before super.initialize() since updateProps accesses this.state.
        // GTK objects can't be created yet because this.widget doesn't exist until super.initialize().
        // The null placeholders are immediately replaced after super.initialize() completes.
        this.state = {
            stringList: null as unknown as Gtk.StringList,
            selectionModel: null as unknown as Gtk.SingleSelection,
            factory: null as unknown as Gtk.SignalListItemFactory,
            renderItem: props.renderItem as RenderItemFn<unknown>,
            listItemCache: new Map(),
            items: [],
            committedLength: 0,
        };

        super.initialize(props);

        const stringList = new Gtk.StringList([]);
        const selectionModel = new Gtk.SingleSelection(getInterface(stringList, Gio.ListModel));
        const factory = new Gtk.SignalListItemFactory();

        this.state.stringList = stringList;
        this.state.selectionModel = selectionModel;
        this.state.factory = factory;

        factory.connect("setup", (_self, listItemObj) => {
            const listItem = getObject<Gtk.ListItem>(listItemObj.id);
            const id = getObjectId(listItemObj.id);

            const box = new Gtk.Box(Gtk.Orientation.VERTICAL, 0);
            listItem.setChild(box);

            const fiberRoot = createFiberRoot(box);
            this.state.listItemCache.set(id, { box, fiberRoot });

            const element = this.state.renderItem(null);
            reconciler.getInstance().updateContainer(element, fiberRoot, null, () => {});
        });

        factory.connect("bind", (_self, listItemObj) => {
            const listItem = getObject<Gtk.ListItem>(listItemObj.id);
            const id = getObjectId(listItemObj.id);
            const info = this.state.listItemCache.get(id);

            if (!info) return;

            const position = listItem.getPosition();
            const item = this.state.items[position];
            const element = this.state.renderItem(item);
            reconciler.getInstance().updateContainer(element, info.fiberRoot, null, () => {});
        });

        factory.connect("unbind", (_self, listItemObj) => {
            const id = getObjectId(listItemObj.id);
            const info = this.state.listItemCache.get(id);

            if (!info) return;

            reconciler.getInstance().updateContainer(null, info.fiberRoot, null, () => {});
        });

        factory.connect("teardown", (_self, listItemObj) => {
            const id = getObjectId(listItemObj.id);
            const info = this.state.listItemCache.get(id);

            if (info) {
                reconciler.getInstance().updateContainer(null, info.fiberRoot, null, () => {});
                this.state.listItemCache.delete(id);
            }
        });

        this.widget.setModel(selectionModel);
        this.widget.setFactory(factory);
    }

    private syncStringList = (): void => {
        const newLength = this.state.items.length;
        if (newLength === this.state.committedLength) return;

        const placeholders = Array.from({ length: newLength }, () => "");
        this.state.stringList.splice(0, this.state.committedLength, placeholders);
        this.state.committedLength = newLength;
    };

    addItem(item: unknown): void {
        this.state.items.push(item);
        scheduleFlush(this.syncStringList);
    }

    insertItemBefore(item: unknown, beforeItem: unknown): void {
        const beforeIndex = this.state.items.indexOf(beforeItem);

        if (beforeIndex === -1) {
            this.state.items.push(item);
        } else {
            this.state.items.splice(beforeIndex, 0, item);
        }

        scheduleFlush(this.syncStringList);
    }

    removeItem(item: unknown): void {
        const index = this.state.items.indexOf(item);

        if (index !== -1) {
            this.state.items.splice(index, 1);
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
            this.state.renderItem = newProps.renderItem as RenderItemFn<unknown>;
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

    override initialize(props: Props): void {
        this.item = props.item as unknown;
        super.initialize(props);
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

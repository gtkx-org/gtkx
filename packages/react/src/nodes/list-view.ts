import { getInterface } from "@gtkx/ffi";
import * as Gio from "@gtkx/ffi/gio";
import * as Gtk from "@gtkx/ffi/gtk";
import { scheduleFlush } from "../batch.js";
import type { ItemContainer } from "../container-interfaces.js";
import type { Props } from "../factory.js";
import { Node } from "../node.js";
import type { RenderItemFn } from "../types.js";
import { connectListItemFactorySignals, type ListItemFactoryHandlers, type ListItemInfo } from "./list-item-factory.js";
import { VirtualItemNode } from "./virtual-item.js";

type ListViewState = {
    stringList: Gtk.StringList;
    selectionModel: Gtk.SingleSelection;
    factory: Gtk.SignalListItemFactory;
    factoryHandlers: ListItemFactoryHandlers | null;
    renderItem: RenderItemFn<unknown>;
    listItemCache: Map<number, ListItemInfo>;
    items: unknown[];
    committedLength: number;
};

export class ListViewNode extends Node<Gtk.ListView | Gtk.GridView, ListViewState> implements ItemContainer<unknown> {
    static matches(type: string): boolean {
        return type === "ListView.Root" || type === "GridView.Root";
    }

    override initialize(props: Props): void {
        this.initializeStateWithPlaceholders(props);
        super.initialize(props);
        this.createGtkModels();
        this.connectFactorySignals();
        this.widget.setModel(this.state.selectionModel);
        this.widget.setFactory(this.state.factory);
    }

    private initializeStateWithPlaceholders(props: Props): void {
        this.state = {
            stringList: null as unknown as Gtk.StringList,
            selectionModel: null as unknown as Gtk.SingleSelection,
            factory: null as unknown as Gtk.SignalListItemFactory,
            factoryHandlers: null,
            renderItem: props.renderItem as RenderItemFn<unknown>,
            listItemCache: new Map(),
            items: [],
            committedLength: 0,
        };
    }

    private createGtkModels(): void {
        const stringList = new Gtk.StringList([]);
        const selectionModel = new Gtk.SingleSelection(getInterface(stringList, Gio.ListModel));
        const factory = new Gtk.SignalListItemFactory();

        this.state.stringList = stringList;
        this.state.selectionModel = selectionModel;
        this.state.factory = factory;
    }

    private connectFactorySignals(): void {
        this.state.factoryHandlers = connectListItemFactorySignals({
            factory: this.state.factory,
            listItemCache: this.state.listItemCache,
            getRenderFn: () => this.state.renderItem,
            getItemAtPosition: (position) => this.state.items[position],
        });
    }

    override detachFromParent(parent: Node): void {
        // Disconnect factory signal handlers to prevent memory leaks
        this.state.factoryHandlers?.disconnect();
        super.detachFromParent(parent);
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

    updateItem(oldItem: unknown, newItem: unknown): void {
        const index = this.state.items.indexOf(oldItem);

        if (index !== -1) {
            this.state.items[index] = newItem;
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

export class ListItemNode extends VirtualItemNode {
    static matches(type: string): boolean {
        return type === "ListView.Item" || type === "GridView.Item";
    }
}

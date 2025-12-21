import * as Gtk from "@gtkx/ffi/gtk";
import type { Props } from "../factory.js";
import type { RenderItemFn } from "../types.js";
import { connectListItemFactorySignals, type ListItemFactoryHandlers, type ListItemInfo } from "./list-item-factory.js";
import { SelectableListNode, type SelectableListState } from "./selectable-list.js";
import { VirtualItemNode } from "./virtual-item.js";

type ListViewState = SelectableListState & {
    factory: Gtk.SignalListItemFactory;
    factoryHandlers: ListItemFactoryHandlers | null;
    renderItem: RenderItemFn<unknown>;
    listItemCache: Map<number, ListItemInfo>;
};

export class ListViewNode extends SelectableListNode<Gtk.ListView | Gtk.GridView, ListViewState> {
    static override consumedPropNames = ["renderItem", "selected", "onSelectionChanged", "selectionMode"];

    static matches(type: string): boolean {
        return type === "GtkListView.Root" || type === "GtkGridView.Root";
    }

    override initialize(props: Props): void {
        const selectionState = this.initializeSelectionState(props);

        this.state = {
            ...selectionState,
            factory: new Gtk.SignalListItemFactory(),
            factoryHandlers: null,
            renderItem: props.renderItem as RenderItemFn<unknown>,
            listItemCache: new Map(),
        };

        super.initialize(props);

        this.state.factoryHandlers = connectListItemFactorySignals({
            factory: this.state.factory,
            listItemCache: this.state.listItemCache,
            getRenderFn: () => this.state.renderItem,
            getItemAtPosition: (position) => this.getItems()[position] ?? null,
        });

        this.applySelectionModel();
        this.widget.setFactory(this.state.factory);
    }

    override unmount(): void {
        this.state.factoryHandlers?.disconnect();
        this.cleanupSelection();
        super.unmount();
    }

    override updateProps(oldProps: Props, newProps: Props): void {
        if (oldProps.renderItem !== newProps.renderItem) {
            this.state.renderItem = newProps.renderItem as RenderItemFn<unknown>;
        }

        this.updateSelectionProps(oldProps, newProps);

        super.updateProps(oldProps, newProps);
    }
}

export class ListItemNode extends VirtualItemNode {
    static matches(type: string): boolean {
        return type === "GtkListView.Item" || type === "GtkGridView.Item";
    }
}

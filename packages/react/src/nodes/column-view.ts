import * as GObject from "@gtkx/ffi/gobject";
import * as Gtk from "@gtkx/ffi/gtk";
import { StringSorter } from "@gtkx/ffi/gtk";
import type { ColumnContainer } from "../containers.js";
import type { Props } from "../factory.js";
import { Node } from "../node.js";
import type { RenderItemFn } from "../types.js";
import { connectListItemFactorySignals, type ListItemFactoryHandlers, type ListItemInfo } from "./list-item-factory.js";
import { SelectableListNode, type SelectableListState } from "./selectable-list.js";
import { VirtualItemNode } from "./virtual-item.js";

type ColumnViewState = SelectableListState & {
    columns: ColumnViewColumnNode[];
    sortColumn: string | null;
    sortOrder: Gtk.SortType;
    onSortChange: ((column: string | null, order: Gtk.SortType) => void) | null;
    sorterChangedHandlerId: number | null;
    lastNotifiedColumn: string | null;
    lastNotifiedOrder: Gtk.SortType;
};

export class ColumnViewNode extends SelectableListNode<Gtk.ColumnView, ColumnViewState> implements ColumnContainer {
    static override consumedPropNames = [
        "sortColumn",
        "sortOrder",
        "onSortChange",
        "selected",
        "onSelectionChanged",
        "selectionMode",
    ];

    static matches(type: string): boolean {
        return type === "GtkColumnView.Root";
    }

    override initialize(props: Props): void {
        const selectionState = this.initializeSelectionState(props);

        this.state = {
            ...selectionState,
            columns: [],
            sortColumn: (props.sortColumn as string | null) ?? null,
            sortOrder: (props.sortOrder as Gtk.SortType | undefined) ?? Gtk.SortType.ASCENDING,
            onSortChange: (props.onSortChange as ((column: string | null, order: Gtk.SortType) => void) | null) ?? null,
            sorterChangedHandlerId: null,
            lastNotifiedColumn: null,
            lastNotifiedOrder: Gtk.SortType.ASCENDING,
        };

        super.initialize(props);

        this.applySelectionModel();
        this.connectSorterChangedSignal();
    }

    private connectSorterChangedSignal(): void {
        const sorter = this.widget.getSorter();
        if (!sorter || !this.state.onSortChange) return;

        this.state.sorterChangedHandlerId = sorter.connect("changed", () => {
            this.notifySortChange();
        });
    }

    private disconnectSorterChangedSignal(): void {
        if (this.state.sorterChangedHandlerId === null) return;

        const sorter = this.widget.getSorter();
        if (sorter) {
            GObject.signalHandlerDisconnect(sorter, this.state.sorterChangedHandlerId);
        }
        this.state.sorterChangedHandlerId = null;
    }

    private notifySortChange(): void {
        if (!this.state.onSortChange) return;

        const sorter = this.widget.getSorter() as Gtk.ColumnViewSorter | null;
        if (!sorter) return;

        const column = sorter.getPrimarySortColumn();
        const order = sorter.getPrimarySortOrder();
        const columnId = column?.getId() ?? null;

        if (columnId === this.state.lastNotifiedColumn && order === this.state.lastNotifiedOrder) {
            return;
        }

        this.state.lastNotifiedColumn = columnId;
        this.state.lastNotifiedOrder = order;
        this.state.onSortChange(columnId, order);
    }

    override unmount(): void {
        this.disconnectSorterChangedSignal();
        this.cleanupSelection();
        super.unmount();
    }

    override appendChild(child: Node): void {
        if (child instanceof ColumnViewColumnNode) {
            child.parent = this;
            this.addColumn(child);
            return;
        }
        super.appendChild(child);
    }

    override insertBefore(child: Node, before: Node): void {
        if (child instanceof ColumnViewColumnNode && before instanceof ColumnViewColumnNode) {
            child.parent = this;
            this.insertColumnBefore(child, before);
            return;
        }
        super.insertBefore(child, before);
    }

    override removeChild(child: Node): void {
        if (child instanceof ColumnViewColumnNode) {
            this.removeColumn(child);
            child.unmount();
            child.parent = null;
            return;
        }
        super.removeChild(child);
    }

    override updateProps(oldProps: Props, newProps: Props): void {
        super.updateProps(oldProps, newProps);

        const newSortColumn = (newProps.sortColumn as string | null) ?? null;
        const newSortOrder = (newProps.sortOrder as Gtk.SortType | undefined) ?? Gtk.SortType.ASCENDING;
        const newOnSortChange =
            (newProps.onSortChange as ((column: string | null, order: Gtk.SortType) => void) | null) ?? null;

        if (oldProps.onSortChange !== newProps.onSortChange) {
            const hadCallback = this.state.onSortChange !== null;
            this.state.onSortChange = newOnSortChange;
            const hasCallback = this.state.onSortChange !== null;

            if (!hadCallback && hasCallback) {
                this.connectSorterChangedSignal();
            } else if (hadCallback && !hasCallback) {
                this.disconnectSorterChangedSignal();
            }
        }

        if (oldProps.sortColumn !== newProps.sortColumn || oldProps.sortOrder !== newProps.sortOrder) {
            this.state.sortColumn = newSortColumn;
            this.state.sortOrder = newSortOrder;
            this.applySortIndicator();
        }

        this.updateSelectionProps(oldProps, newProps);
    }

    private applySortIndicator(): void {
        if (this.state.sortColumn === null) {
            this.widget.sortByColumn(this.state.sortOrder);
            return;
        }

        const column = this.state.columns.find((c) => c.getId() === this.state.sortColumn);
        if (column) {
            this.widget.sortByColumn(this.state.sortOrder, column.getColumn());
        }
    }

    addColumn(columnNode: ColumnViewColumnNode): void {
        this.state.columns.push(columnNode);
        this.widget.appendColumn(columnNode.getColumn());
        columnNode.setColumnView(this);

        if (columnNode.getId() === this.state.sortColumn) {
            this.applySortIndicator();
        }
    }

    insertColumnBefore(column: ColumnViewColumnNode, before: ColumnViewColumnNode): void {
        const beforeIndex = this.state.columns.indexOf(before);
        if (beforeIndex === -1) {
            this.addColumn(column);
            return;
        }

        this.state.columns.splice(beforeIndex, 0, column);
        this.widget.insertColumn(beforeIndex, column.getColumn());
        column.setColumnView(this);
    }

    removeColumn(column: ColumnViewColumnNode): void {
        const index = this.state.columns.indexOf(column);
        if (index !== -1) {
            this.state.columns.splice(index, 1);
            this.widget.removeColumn(column.getColumn());
            column.setColumnView(null);
        }
    }
}

type ColumnViewColumnState = {
    column: Gtk.ColumnViewColumn;
    factory: Gtk.SignalListItemFactory;
    factoryHandlers: ListItemFactoryHandlers | null;
    renderCell: RenderItemFn<unknown>;
    columnId?: string;
    listItemCache: Map<number, ListItemInfo>;
    sorter?: StringSorter;
};

export class ColumnViewColumnNode extends Node<never, ColumnViewColumnState> {
    static override consumedPropNames = ["renderCell", "title", "expand", "resizable", "fixedWidth", "id", "sortable"];

    static matches(type: string): boolean {
        return type === "GtkColumnView.Column";
    }

    protected override isVirtual(): boolean {
        return true;
    }

    private columnView: ColumnViewNode | null = null;

    override initialize(props: Props): void {
        const factory = new Gtk.SignalListItemFactory();
        const column = new Gtk.ColumnViewColumn(props.title as string | undefined, factory);
        const columnId = (props.id as string | undefined) ?? undefined;

        const sortable = props.sortable as boolean | undefined;
        const sorter = sortable ? new StringSorter() : undefined;

        this.state = {
            column,
            factory,
            factoryHandlers: null,
            renderCell: props.renderCell as RenderItemFn<unknown>,
            columnId,
            listItemCache: new Map(),
            sorter,
        };

        if (sorter) {
            column.setSorter(sorter);
        }

        super.initialize(props);

        if (columnId !== null) {
            column.setId(columnId);
        }

        if (props.expand !== undefined) {
            column.setExpand(props.expand as boolean);
        }

        if (props.resizable !== undefined) {
            column.setResizable(props.resizable as boolean);
        }

        if (props.fixedWidth !== undefined) {
            column.setFixedWidth(props.fixedWidth as number);
        }

        this.state.factoryHandlers = connectListItemFactorySignals({
            factory,
            listItemCache: this.state.listItemCache,
            getRenderFn: () => this.state.renderCell,
            getItemAtPosition: (position) => this.columnView?.getItems()[position] ?? null,
        });
    }

    getColumn(): Gtk.ColumnViewColumn {
        return this.state.column;
    }

    getId(): string | undefined {
        return this.state.columnId;
    }

    setColumnView(columnView: ColumnViewNode | null): void {
        this.columnView = columnView;
    }

    override unmount(): void {
        this.state.factoryHandlers?.disconnect();
        super.unmount();
    }

    override updateProps(oldProps: Props, newProps: Props): void {
        if (oldProps.renderCell !== newProps.renderCell) {
            this.state.renderCell = newProps.renderCell as RenderItemFn<unknown>;
        }

        if (oldProps.title !== newProps.title) {
            this.state.column.setTitle(newProps.title as string | undefined);
        }
        if (oldProps.expand !== newProps.expand) {
            this.state.column.setExpand(newProps.expand as boolean);
        }
        if (oldProps.resizable !== newProps.resizable) {
            this.state.column.setResizable(newProps.resizable as boolean);
        }
        if (oldProps.fixedWidth !== newProps.fixedWidth) {
            this.state.column.setFixedWidth(newProps.fixedWidth as number);
        }
        if (oldProps.id !== newProps.id) {
            this.state.columnId = (newProps.id as string | undefined) ?? undefined;
            this.state.column.setId(this.state.columnId);
        }
        if (oldProps.sortable !== newProps.sortable) {
            const sortable = newProps.sortable as boolean | undefined;
            if (sortable && !this.state.sorter) {
                this.state.sorter = new StringSorter();
                this.state.column.setSorter(this.state.sorter);
            } else if (!sortable && this.state.sorter) {
                this.state.column.setSorter(undefined);
                this.state.sorter = undefined;
            }
        }
    }
}

export class ColumnViewItemNode extends VirtualItemNode {
    static matches(type: string): boolean {
        return type === "GtkColumnView.Item";
    }
}

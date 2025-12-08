import { getObject, getObjectId } from "@gtkx/ffi";
import type * as Gio from "@gtkx/ffi/gio";
import * as GObject from "@gtkx/ffi/gobject";
import * as Gtk from "@gtkx/ffi/gtk";
import type Reconciler from "react-reconciler";
import { scheduleFlush } from "../batch.js";
import {
    type ColumnContainer,
    type ItemContainer,
    isColumnContainer,
    isItemContainer,
} from "../container-interfaces.js";
import type { Props } from "../factory.js";
import { createFiberRoot } from "../fiber-root.js";
import { Node } from "../node.js";
import { reconciler } from "../reconciler.js";
import type { ColumnSortFn, RenderItemFn } from "../types.js";

export class ColumnViewNode extends Node<Gtk.ColumnView> implements ItemContainer<unknown>, ColumnContainer {
    static matches(type: string): boolean {
        return type === "ColumnView.Root";
    }

    private stringList: Gtk.StringList;
    private selectionModel: Gtk.SingleSelection;
    private sortListModel: Gtk.SortListModel;
    private items: unknown[] = [];
    private columns: ColumnViewColumnNode[] = [];
    private committedLength = 0;
    private sortColumn: string | null = null;
    private sortOrder: Gtk.SortType = Gtk.SortType.ASCENDING;
    private sortFn: ColumnSortFn<unknown, string> | null = null;
    private isSorting = false;
    private onSortChange: ((column: string | null, order: Gtk.SortType) => void) | null = null;
    private sorterChangedHandlerId: number | null = null;
    private lastNotifiedColumn: string | null = null;
    private lastNotifiedOrder: Gtk.SortType = Gtk.SortType.ASCENDING;

    constructor(type: string, props: Props) {
        super(type, props);

        this.stringList = new Gtk.StringList([]);
        this.sortListModel = new Gtk.SortListModel(
            this.stringList as unknown as Gio.ListModel,
            this.widget.getSorter(),
        );
        this.sortListModel.setIncremental(true);
        this.selectionModel = new Gtk.SingleSelection(this.sortListModel as unknown as Gio.ListModel);
        this.widget.setModel(this.selectionModel);

        this.sortColumn = (props.sortColumn as string | null) ?? null;
        this.sortOrder = (props.sortOrder as Gtk.SortType | undefined) ?? Gtk.SortType.ASCENDING;
        this.sortFn = (props.sortFn as ColumnSortFn<unknown, string> | null) ?? null;
        this.onSortChange =
            (props.onSortChange as ((column: string | null, order: Gtk.SortType) => void) | null) ?? null;

        this.connectSorterChangedSignal();
    }

    private connectSorterChangedSignal(): void {
        const sorter = this.widget.getSorter();
        if (!sorter || !this.onSortChange) return;

        this.sorterChangedHandlerId = sorter.connect("changed", () => {
            this.waitForSortComplete(() => this.notifySortChange());
        });
    }

    private waitForSortComplete(callback: () => void): void {
        const pending = this.sortListModel.getPending();
        if (pending === 0) {
            callback();
        } else {
            // Sorting still in progress, check again after a short delay
            setTimeout(() => this.waitForSortComplete(callback), 10);
        }
    }

    private disconnectSorterChangedSignal(): void {
        if (this.sorterChangedHandlerId === null) return;

        const sorter = this.widget.getSorter();
        if (sorter) {
            GObject.signalHandlerDisconnect(sorter, this.sorterChangedHandlerId);
        }
        this.sorterChangedHandlerId = null;
    }

    private notifySortChange(): void {
        if (!this.onSortChange) return;

        const baseSorter = this.widget.getSorter();
        if (!baseSorter) return;

        const sorter = getObject(baseSorter.ptr, Gtk.ColumnViewSorter);
        const column = sorter.getPrimarySortColumn();
        const order = sorter.getPrimarySortOrder();
        const columnId = column?.getId() ?? null;

        // Deduplicate: only notify if the sort state actually changed
        if (columnId === this.lastNotifiedColumn && order === this.lastNotifiedOrder) {
            return;
        }

        this.lastNotifiedColumn = columnId;
        this.lastNotifiedOrder = order;
        this.onSortChange(columnId, order);
    }

    getItems(): unknown[] {
        return this.items;
    }

    getSortFn(): ColumnSortFn<unknown, string> | null {
        return this.sortFn;
    }

    compareItems(a: unknown, b: unknown, columnId: string): number {
        if (this.isSorting || !this.sortFn) return 0;

        this.isSorting = true;
        try {
            return this.sortFn(a, b, columnId);
        } finally {
            this.isSorting = false;
        }
    }

    addColumn(columnNode: ColumnViewColumnNode): void {
        this.columns.push(columnNode);
        const column = columnNode.getColumn();
        this.widget.appendColumn(column);
        columnNode.setColumnView(this);

        if (columnNode.getId() === this.sortColumn && this.sortColumn !== null) {
            this.applySortByColumn();
        }
    }

    private applySortByColumn(): void {
        if (this.sortColumn === null) {
            this.widget.sortByColumn(this.sortOrder, null);
            return;
        }

        if (!this.columns) return;

        const column = this.columns.find((c) => c.getId() === this.sortColumn);
        if (column) {
            this.widget.sortByColumn(this.sortOrder, column.getColumn());
        }
    }

    findColumnById(id: string): ColumnViewColumnNode | undefined {
        return this.columns.find((c) => c.getId() === id);
    }

    removeColumn(column: ColumnViewColumnNode): void {
        const index = this.columns.indexOf(column);
        if (index !== -1) {
            this.columns.splice(index, 1);
            this.widget.removeColumn(column.getColumn());
            column.setColumnView(null);
        }
    }

    insertColumnBefore(column: ColumnViewColumnNode, before: ColumnViewColumnNode): void {
        const beforeIndex = this.columns.indexOf(before);
        if (beforeIndex === -1) {
            this.addColumn(column);
            return;
        }

        this.columns.splice(beforeIndex, 0, column);
        this.widget.insertColumn(beforeIndex, column.getColumn());
        column.setColumnView(this);
    }

    private syncStringList = (): void => {
        const newLength = this.items.length;
        if (newLength === this.committedLength) return;

        // Store indices as strings so we can map back to items in the sorter
        const indices = Array.from({ length: newLength }, (_, i) => String(i));
        this.stringList.splice(0, this.committedLength, indices);
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
        consumed.add("sortColumn");
        consumed.add("sortOrder");
        consumed.add("onSortChange");
        consumed.add("sortFn");
        return consumed;
    }

    override updateProps(oldProps: Props, newProps: Props): void {
        super.updateProps(oldProps, newProps);

        const newSortColumn = (newProps.sortColumn as string | null) ?? null;
        const newSortOrder = (newProps.sortOrder as Gtk.SortType | undefined) ?? Gtk.SortType.ASCENDING;
        const newSortFn = (newProps.sortFn as ColumnSortFn<unknown, string> | null) ?? null;
        const newOnSortChange =
            (newProps.onSortChange as ((column: string | null, order: Gtk.SortType) => void) | null) ?? null;

        if (oldProps.onSortChange !== newProps.onSortChange) {
            const hadCallback = this.onSortChange !== null;
            this.onSortChange = newOnSortChange;
            const hasCallback = this.onSortChange !== null;

            // Connect or disconnect the signal handler as needed
            if (!hadCallback && hasCallback) {
                this.connectSorterChangedSignal();
            } else if (hadCallback && !hasCallback) {
                this.disconnectSorterChangedSignal();
            }
        }

        if (oldProps.sortFn !== newProps.sortFn) {
            this.sortFn = newSortFn;
            if (this.columns) {
                for (const column of this.columns) {
                    column.updateSorterFromRoot();
                }
            }
        }

        if (oldProps.sortColumn !== newProps.sortColumn || oldProps.sortOrder !== newProps.sortOrder) {
            this.sortColumn = newSortColumn;
            this.sortOrder = newSortOrder;
            this.applySortByColumn();
        }
    }
}

interface ListItemInfo {
    box: Gtk.Box;
    fiberRoot: Reconciler.FiberRoot;
}

export class ColumnViewColumnNode extends Node {
    static matches(type: string): boolean {
        return type === "ColumnView.Column";
    }

    protected override isVirtual(): boolean {
        return true;
    }

    private column: Gtk.ColumnViewColumn;
    private factory: Gtk.SignalListItemFactory;
    private renderCell: RenderItemFn<unknown>;
    private columnView: ColumnViewNode | null = null;
    private listItemCache = new Map<number, ListItemInfo>();
    private columnId: string | null = null;
    private sorter: Gtk.CustomSorter | null = null;

    constructor(type: string, props: Props) {
        super(type, props);

        this.factory = new Gtk.SignalListItemFactory();
        this.column = new Gtk.ColumnViewColumn(props.title as string | undefined, this.factory);

        this.renderCell = props.renderCell as RenderItemFn<unknown>;
        this.columnId = (props.id as string | null) ?? null;

        if (this.columnId !== null) {
            this.column.setId(this.columnId);
        }

        if (props.expand !== undefined) {
            this.column.setExpand(props.expand as boolean);
        }

        if (props.resizable !== undefined) {
            this.column.setResizable(props.resizable as boolean);
        }

        if (props.fixedWidth !== undefined) {
            this.column.setFixedWidth(props.fixedWidth as number);
        }

        this.factory.connect("setup", (_self, listItemObj) => {
            const listItem = getObject(listItemObj.ptr, Gtk.ListItem);
            const id = getObjectId(listItemObj.ptr);

            const box = new Gtk.Box(Gtk.Orientation.VERTICAL, 0);
            listItem.setChild(box);

            const fiberRoot = createFiberRoot(box);
            this.listItemCache.set(id, { box, fiberRoot });

            const element = this.renderCell(null);
            reconciler.getInstance().updateContainer(element, fiberRoot, null, () => {});
        });

        this.factory.connect("bind", (_self, listItemObj) => {
            const listItem = getObject(listItemObj.ptr, Gtk.ListItem);
            const id = getObjectId(listItemObj.ptr);
            const info = this.listItemCache.get(id);

            if (!info) return;

            const position = listItem.getPosition();

            if (this.columnView) {
                const items = this.columnView.getItems();
                const item = items[position];
                const element = this.renderCell(item ?? null);
                reconciler.getInstance().updateContainer(element, info.fiberRoot, null, () => {});
            }
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
    }

    getColumn(): Gtk.ColumnViewColumn {
        return this.column;
    }

    getId(): string | null {
        return this.columnId;
    }

    setColumnView(columnView: ColumnViewNode | null): void {
        this.columnView = columnView;
        this.updateSorterFromRoot();
    }

    updateSorterFromRoot(): void {
        if (!this.columnView || this.columnId === null) {
            this.column.setSorter(null);
            this.sorter = null;
            return;
        }

        const rootSortFn = this.columnView.getSortFn();
        if (rootSortFn === null) {
            this.column.setSorter(null);
            this.sorter = null;
            return;
        }

        const columnId = this.columnId;
        const columnView = this.columnView;
        const wrappedSortFn = (_a: unknown, _b: unknown): number => {
            const items = columnView.getItems();

            // _a and _b are GtkStringObject pointers - get the string content (indices)
            const stringObjA = getObject(_a, Gtk.StringObject);
            const stringObjB = getObject(_b, Gtk.StringObject);
            const indexA = Number.parseInt(stringObjA.getString(), 10);
            const indexB = Number.parseInt(stringObjB.getString(), 10);

            if (Number.isNaN(indexA) || Number.isNaN(indexB)) return 0;

            const itemA = items[indexA] ?? null;
            const itemB = items[indexB] ?? null;

            if (itemA === null || itemB === null) return 0;

            const result = columnView.compareItems(itemA, itemB, columnId);
            return typeof result === "number" ? result : 0;
        };

        this.sorter = new Gtk.CustomSorter(wrappedSortFn);
        this.column.setSorter(this.sorter);
    }

    override attachToParent(parent: Node): void {
        if (isColumnContainer(parent)) {
            parent.addColumn(this);
        }
    }

    override attachToParentBefore(parent: Node, before: Node): void {
        if (isColumnContainer(parent) && before instanceof ColumnViewColumnNode) {
            parent.insertColumnBefore(this, before);
        } else {
            this.attachToParent(parent);
        }
    }

    override detachFromParent(parent: Node): void {
        if (isColumnContainer(parent)) {
            parent.removeColumn(this);
        }
    }

    protected override consumedProps(): Set<string> {
        const consumed = super.consumedProps();
        consumed.add("renderCell");
        consumed.add("title");
        consumed.add("expand");
        consumed.add("resizable");
        consumed.add("fixedWidth");
        consumed.add("id");
        return consumed;
    }

    override updateProps(oldProps: Props, newProps: Props): void {
        if (oldProps.renderCell !== newProps.renderCell) {
            this.renderCell = newProps.renderCell as RenderItemFn<unknown>;
        }

        if (!this.column) return;

        if (oldProps.title !== newProps.title) {
            this.column.setTitle(newProps.title as string | undefined);
        }
        if (oldProps.expand !== newProps.expand) {
            this.column.setExpand(newProps.expand as boolean);
        }
        if (oldProps.resizable !== newProps.resizable) {
            this.column.setResizable(newProps.resizable as boolean);
        }
        if (oldProps.fixedWidth !== newProps.fixedWidth) {
            this.column.setFixedWidth(newProps.fixedWidth as number);
        }
        if (oldProps.id !== newProps.id) {
            this.columnId = (newProps.id as string | null) ?? null;
            this.column.setId(this.columnId);
        }
    }
}

export class ColumnViewItemNode extends Node {
    static matches(type: string): boolean {
        return type === "ColumnView.Item";
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
        if (isItemContainer(parent) && before instanceof ColumnViewItemNode) {
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

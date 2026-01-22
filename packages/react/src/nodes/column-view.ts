import * as Gtk from "@gtkx/ffi/gtk";
import { COLUMN_VIEW_CLASSES } from "../generated/internal.js";
import type { Node } from "../node.js";
import { registerNodeClass } from "../registry.js";
import type { Container, ContainerClass } from "../types.js";
import { ColumnViewColumnNode } from "./column-view-column.js";
import { signalStore } from "./internal/signal-store.js";
import { filterProps, matchesAnyClass } from "./internal/utils.js";
import { ListItemNode } from "./list-item.js";
import { ListModel, type ListProps } from "./models/list.js";
import { WidgetNode } from "./widget.js";

const PROP_NAMES = ["sortColumn", "sortOrder", "onSortChanged", "estimatedRowHeight"] as const;

type ColumnViewProps = ListProps & {
    sortColumn?: string;
    sortOrder?: Gtk.SortType;
    onSortChanged?: (column: string | null, order: Gtk.SortType) => void;
    estimatedRowHeight?: number;
};

class ColumnViewNode extends WidgetNode<Gtk.ColumnView, ColumnViewProps> {
    public static override priority = 1;

    private handleSortChange: (() => void) | null = null;
    private list: ListModel;
    private columnNodes = new Set<ColumnViewColumnNode>();
    private estimatedRowHeight: number | null = null;

    public static override matches(_type: string, containerOrClass?: Container | ContainerClass | null): boolean {
        return matchesAnyClass(COLUMN_VIEW_CLASSES, containerOrClass);
    }

    constructor(typeName: string, props: ColumnViewProps, container: Gtk.ColumnView, rootContainer?: Container) {
        super(typeName, props, container, rootContainer);
        this.list = new ListModel({
            selectionMode: props.selectionMode,
            selected: props.selected,
            onSelectionChanged: props.onSelectionChanged,
        });
    }

    public override mount(): void {
        super.mount();
        this.container.setModel(this.list.getSelectionModel());
    }

    public override appendChild(child: Node): void {
        if (child instanceof ListItemNode) {
            this.list.appendChild(child);
            return;
        }

        if (!(child instanceof ColumnViewColumnNode)) {
            throw new Error(
                `Cannot append '${child.typeName}' to 'ColumnView': expected x.ColumnViewColumn or x.ListItem`,
            );
        }

        const existingColumn = this.findColumnInView(child.column);

        if (existingColumn) {
            this.container.removeColumn(existingColumn);
        }

        child.setStore(this.list.getStore());
        child.setEstimatedRowHeight(this.estimatedRowHeight);
        this.container.appendColumn(child.column);
        this.columnNodes.add(child);
    }

    public override insertBefore(child: Node, before: Node): void {
        if (child instanceof ListItemNode) {
            this.list.insertBefore(child, before);
            return;
        }

        if (!(child instanceof ColumnViewColumnNode)) {
            throw new Error(
                `Cannot insert '${child.typeName}' into 'ColumnView': expected x.ColumnViewColumn or x.ListItem`,
            );
        }

        const existingColumn = this.findColumnInView(child.column);

        if (existingColumn) {
            this.container.removeColumn(existingColumn);
        }

        child.setStore(this.list.getStore());
        child.setEstimatedRowHeight(this.estimatedRowHeight);

        if (before instanceof ColumnViewColumnNode) {
            const beforeIndex = this.getColumnIndex(before.column);
            this.container.insertColumn(beforeIndex, child.column);
        } else {
            this.container.appendColumn(child.column);
        }

        this.columnNodes.add(child);
    }

    public override removeChild(child: Node): void {
        if (child instanceof ListItemNode) {
            this.list.removeChild(child);
            return;
        }

        if (!(child instanceof ColumnViewColumnNode)) {
            throw new Error(
                `Cannot remove '${child.typeName}' from 'ColumnView': expected x.ColumnViewColumn or x.ListItem`,
            );
        }

        const existingColumn = this.findColumnInView(child.column);

        if (existingColumn) {
            this.container.removeColumn(existingColumn);
        }

        child.setStore(null);
        this.columnNodes.delete(child);
    }

    public override updateProps(oldProps: ColumnViewProps | null, newProps: ColumnViewProps): void {
        super.updateProps(oldProps ? filterProps(oldProps, PROP_NAMES) : null, filterProps(newProps, PROP_NAMES));
        this.applyOwnProps(oldProps, newProps);
        this.list.updateProps(oldProps, newProps);
    }

    protected applyOwnProps(oldProps: ColumnViewProps | null, newProps: ColumnViewProps): void {
        if (!oldProps || oldProps.onSortChanged !== newProps.onSortChanged) {
            const sorter = this.container.getSorter() as Gtk.ColumnViewSorter | null;
            const onSortChanged = newProps.onSortChanged;

            if (sorter) {
                this.handleSortChange = () => {
                    onSortChanged?.(sorter.getPrimarySortColumn()?.getId() ?? null, sorter.getPrimarySortOrder());
                };

                signalStore.set(this, sorter, "changed", this.handleSortChange);
            }
        }

        if (!oldProps || oldProps.sortColumn !== newProps.sortColumn || oldProps.sortOrder !== newProps.sortOrder) {
            const sortColumn = newProps.sortColumn;
            const sortOrder = newProps.sortOrder ?? Gtk.SortType.ASCENDING;

            if (!sortColumn) {
                this.container.sortByColumn(sortOrder, undefined);
            } else {
                this.container.sortByColumn(sortOrder, this.getColumn(sortColumn));
            }
        }

        if (!oldProps || oldProps.estimatedRowHeight !== newProps.estimatedRowHeight) {
            this.estimatedRowHeight = newProps.estimatedRowHeight ?? null;
            for (const column of this.columnNodes) {
                column.setEstimatedRowHeight(this.estimatedRowHeight);
            }
        }
    }

    private findColumn<T>(predicate: (column: Gtk.ColumnViewColumn, index: number) => T | null): T | null {
        const columns = this.container.getColumns();
        for (let i = 0; i < columns.getNItems(); i++) {
            const column = columns.getObject(i) as Gtk.ColumnViewColumn;
            const result = predicate(column, i);
            if (result !== null) return result;
        }
        return null;
    }

    private getColumn(columnId: string): Gtk.ColumnViewColumn {
        const column = this.findColumn((col) => (col.getId() === columnId ? col : null));
        if (!column) {
            throw new Error(`Unable to find column '${columnId}' in ColumnView`);
        }
        return column;
    }

    private getColumnIndex(column: Gtk.ColumnViewColumn): number {
        const targetId = column.getId();
        const index = this.findColumn((col, i) => (col.getId() === targetId ? i : null));
        if (index === null) {
            throw new Error(`Unable to find column '${targetId}' in ColumnView`);
        }
        return index;
    }

    private findColumnInView(column: Gtk.ColumnViewColumn): Gtk.ColumnViewColumn | null {
        const targetId = column.getId();
        return this.findColumn((col) => (col.getId() === targetId ? col : null));
    }

    public override unmount(): void {
        this.columnNodes.clear();
        super.unmount();
    }
}

registerNodeClass(ColumnViewNode);

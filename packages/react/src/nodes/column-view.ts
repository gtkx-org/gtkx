import * as Gtk from "@gtkx/ffi/gtk";
import { COLUMN_VIEW_CLASSES } from "../generated/internal.js";
import type { Node } from "../node.js";
import { registerNodeClass } from "../registry.js";
import type { Container, ContainerClass } from "../types.js";
import { ColumnViewColumnNode } from "./column-view-column.js";
import { signalStore } from "./internal/signal-store.js";
import { filterProps, matchesAnyClass } from "./internal/utils.js";
import { ListItemNode } from "./list-item.js";
import { List, type ListProps } from "./models/list.js";
import { WidgetNode } from "./widget.js";

const PROP_NAMES = ["sortColumn", "sortOrder", "onSortChange"];

type ColumnViewProps = ListProps & {
    sortColumn?: string;
    sortOrder?: Gtk.SortType;
    onSortChange?: (column: string | null, order: Gtk.SortType) => void;
};

class ColumnViewNode extends WidgetNode<Gtk.ColumnView, ColumnViewProps> {
    public static override priority = 1;

    private handleSortChange?: () => void;
    private list: List;

    public static override matches(_type: string, containerOrClass?: Container | ContainerClass | null): boolean {
        return matchesAnyClass(COLUMN_VIEW_CLASSES, containerOrClass);
    }

    constructor(typeName: string, props: ColumnViewProps, container: Gtk.ColumnView, rootContainer?: Container) {
        super(typeName, props, container, rootContainer);
        this.list = new List(props.selectionMode);
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
            throw new Error(`Cannot append '${child.typeName}' to 'ColumnView': expected ColumnViewColumn`);
        }

        const existingColumn = this.findColumnInView(child.column);

        if (existingColumn) {
            this.container.removeColumn(existingColumn);
        }

        this.container.appendColumn(child.column);
        child.setStore(this.list.getStore());
    }

    public override insertBefore(child: Node, before: Node): void {
        if (child instanceof ListItemNode) {
            this.list.insertBefore(child, before);
            return;
        }

        if (!(child instanceof ColumnViewColumnNode)) {
            throw new Error(`Cannot insert '${child.typeName}' to 'ColumnView': expected ColumnViewColumn`);
        }

        const existingColumn = this.findColumnInView(child.column);

        if (existingColumn) {
            this.container.removeColumn(existingColumn);
        }

        if (before instanceof ColumnViewColumnNode) {
            const beforeIndex = this.getColumnIndex(before.column);
            this.container.insertColumn(beforeIndex, child.column);
        } else {
            this.container.appendColumn(child.column);
        }

        child.setStore(this.list.getStore());
    }

    public override removeChild(child: Node): void {
        if (child instanceof ListItemNode) {
            this.list.removeChild(child);
            return;
        }

        if (!(child instanceof ColumnViewColumnNode)) {
            throw new Error(`Cannot remove '${child.typeName}' from 'ColumnView': expected ColumnViewColumn`);
        }

        const existingColumn = this.findColumnInView(child.column);

        if (existingColumn) {
            this.container.removeColumn(existingColumn);
        }

        child.setStore(undefined);
    }

    public override updateProps(oldProps: ColumnViewProps | null, newProps: ColumnViewProps): void {
        if (!oldProps || oldProps.onSortChange !== newProps.onSortChange) {
            const sorter = this.container.getSorter() as Gtk.ColumnViewSorter | null;
            const onSortChange = newProps.onSortChange;

            if (sorter) {
                this.handleSortChange = () => {
                    onSortChange?.(sorter.getPrimarySortColumn()?.getId() ?? null, sorter.getPrimarySortOrder());
                };

                signalStore.set(this, sorter, "changed", this.handleSortChange);
            }
        }

        if (!oldProps || oldProps.sortColumn !== newProps.sortColumn || oldProps.sortOrder !== newProps.sortOrder) {
            const sortColumn = newProps.sortColumn;
            const sortOrder = newProps.sortOrder ?? Gtk.SortType.ASCENDING;

            if (!sortColumn) {
                this.container.sortByColumn(undefined, sortOrder);
            } else {
                this.container.sortByColumn(this.getColumn(sortColumn), sortOrder);
            }
        }

        this.list.updateProps(filterProps(oldProps ?? {}, PROP_NAMES), filterProps(newProps, PROP_NAMES));
        super.updateProps(filterProps(oldProps ?? {}, PROP_NAMES), filterProps(newProps, PROP_NAMES));
    }

    private getColumn(columnId: string): Gtk.ColumnViewColumn {
        const columns = this.container.getColumns();

        for (let i = 0; i < columns.getNItems(); i++) {
            const column = columns.getObject(i) as Gtk.ColumnViewColumn;

            if (column.getId() === columnId) {
                return column;
            }
        }

        throw new Error(`Unable to find column '${columnId}' in ColumnView`);
    }

    private getColumnIndex(column: Gtk.ColumnViewColumn): number {
        const index = this.findColumnIndex(column);
        if (index === -1) {
            throw new Error(`Unable to find column '${column.getId()}' in ColumnView`);
        }
        return index;
    }

    private findColumnIndex(column: Gtk.ColumnViewColumn): number {
        const columns = this.container.getColumns();

        for (let i = 0; i < columns.getNItems(); i++) {
            const col = columns.getObject(i) as Gtk.ColumnViewColumn;

            if (col.getId() === column.getId()) {
                return i;
            }
        }

        return -1;
    }

    private findColumnInView(column: Gtk.ColumnViewColumn): Gtk.ColumnViewColumn | null {
        const columns = this.container.getColumns();
        const targetId = column.getId();

        for (let i = 0; i < columns.getNItems(); i++) {
            const col = columns.getObject(i) as Gtk.ColumnViewColumn;

            if (col.getId() === targetId) {
                return col;
            }
        }

        return null;
    }
}

registerNodeClass(ColumnViewNode);

import * as Gtk from "@gtkx/ffi/gtk";
import type { Node } from "../node.js";
import { registerNodeClass } from "../registry.js";
import type { Container, ContainerClass } from "../types.js";
import { ColumnViewColumnNode } from "./column-view-column.js";
import { filterProps, isContainerType } from "./internal/helpers.js";
import { ListItemNode } from "./list-item.js";
import { List, type ListProps } from "./models/list.js";
import { WidgetNode } from "./widget.js";

const PROP_NAMES = ["sortColumn", "sortOrder", "onSortChange"];

type ColumnViewProps = ListProps & {
    sortColumn?: string;
    sortOrder?: Gtk.SortType;
    onSortChange?: (column: string | null, order: Gtk.SortType) => void;
};

export class ColumnViewNode extends WidgetNode<Gtk.ColumnView, ColumnViewProps> {
    public static override priority = 1;

    private handleSortChange?: () => void;
    private list: List;

    public static override matches(_type: string, containerOrClass?: Container | ContainerClass): boolean {
        return isContainerType(Gtk.ColumnView, containerOrClass);
    }

    constructor(typeName: string, props: ColumnViewProps, container: Gtk.ColumnView, rootContainer?: Container) {
        super(typeName, props, container, rootContainer);
        this.list = new List(props.selectionMode);
    }

    public override appendChild(child: Node): void {
        if (child instanceof ListItemNode) {
            this.list.appendChild(child);
            return;
        }

        if (!(child instanceof ColumnViewColumnNode)) {
            throw new Error(`Cannot append child of type ${child.typeName} to ColumnView`);
        }

        this.container.appendColumn(child.column);
        child.setStore(this.list.getStore());
    }

    public override insertBefore(child: Node, before: Node): void {
        if (child instanceof ListItemNode) {
            this.list.insertBefore(child, before);
            return;
        }

        if (!(child instanceof ColumnViewColumnNode) || !(before instanceof ColumnViewColumnNode)) {
            throw new Error(`Cannot insert child of type ${child.typeName} before ${before.typeName} in ColumnView`);
        }

        const beforeIndex = this.getColumnIndex(before.column);
        this.container.insertColumn(beforeIndex, child.column);
        child.setStore(this.list.getStore());
    }

    public override removeChild(child: Node): void {
        if (child instanceof ListItemNode) {
            this.list.removeChild(child);
            return;
        }

        if (!(child instanceof ColumnViewColumnNode)) {
            throw new Error(`Cannot remove child of type ${child.typeName} from ColumnView`);
        }

        this.container.removeColumn(child.column);
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

                this.signalStore.set(sorter, "changed", this.handleSortChange);
            }
        }

        if (!oldProps || oldProps.sortColumn !== newProps.sortColumn || oldProps.sortOrder !== newProps.sortOrder) {
            this.signalStore.block(() => {
                const sortColumn = newProps.sortColumn;
                const sortOrder = newProps.sortOrder ?? Gtk.SortType.ASCENDING;

                if (!sortColumn) {
                    this.container.sortByColumn(sortOrder);
                } else {
                    this.container.sortByColumn(sortOrder, this.getColumn(sortColumn));
                }
            });
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

        throw new Error(`Column ${columnId} not found in ColumnView`);
    }

    private getColumnIndex(column: Gtk.ColumnViewColumn): number {
        const columns = this.container.getColumns();

        for (let i = 0; i < columns.getNItems(); i++) {
            const col = columns.getObject(i) as Gtk.ColumnViewColumn;

            if (col.getId() === column.getId()) {
                return i;
            }
        }

        throw new Error(`Column ${column.getId()} not found in ColumnView`);
    }
}

registerNodeClass(ColumnViewNode);

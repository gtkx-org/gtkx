import * as Gtk from "@gtkx/ffi/gtk";
import type { GtkColumnViewProps } from "../jsx.js";
import type { Node } from "../node.js";
import type { Container } from "../types.js";
import { ColumnViewColumnNode } from "./column-view-column.js";
import { ContainerSlotNode } from "./container-slot.js";
import { EventControllerNode } from "./event-controller.js";
import type { HeaderItemRenderer } from "./internal/header-item-renderer.js";
import { updateHeaderRenderer } from "./internal/header-renderer-manager.js";
import { filterProps, hasChanged } from "./internal/props.js";
import { ListItemNode } from "./list-item.js";
import { ListSectionNode } from "./list-section.js";
import { ListModel, type ListModelProps } from "./models/list.js";
import { SlotNode } from "./slot.js";
import { WidgetNode } from "./widget.js";

const OWN_PROPS = ["sortColumn", "sortOrder", "onSortChanged", "estimatedRowHeight", "renderHeader"] as const;

type ColumnViewProps = Pick<GtkColumnViewProps, (typeof OWN_PROPS)[number]> & ListModelProps;
type ColumnViewChild =
    | ListItemNode
    | ListSectionNode
    | ColumnViewColumnNode
    | EventControllerNode
    | SlotNode
    | ContainerSlotNode;

export class ColumnViewNode extends WidgetNode<Gtk.ColumnView, ColumnViewProps, ColumnViewChild> {
    private list: ListModel;
    private headerRenderer: HeaderItemRenderer | null = null;

    public override isValidChild(child: Node): boolean {
        return (
            child instanceof ListItemNode ||
            child instanceof ListSectionNode ||
            child instanceof ColumnViewColumnNode ||
            child instanceof EventControllerNode ||
            child instanceof SlotNode ||
            child instanceof ContainerSlotNode
        );
    }
    private columnNodes = new Set<ColumnViewColumnNode>();
    private estimatedRowHeight: number | null = null;

    constructor(typeName: string, props: ColumnViewProps, container: Gtk.ColumnView, rootContainer: Container) {
        super(typeName, props, container, rootContainer);

        const flat = props.renderHeader != null;

        this.list = new ListModel(
            { owner: this, signalStore: this.signalStore },
            {
                selectionMode: props.selectionMode,
                selected: props.selected,
                onSelectionChanged: props.onSelectionChanged,
            },
            flat,
        );
        this.list.setOnItemUpdated((id) => {
            for (const column of this.columnNodes) {
                column.rebindItem(id);
            }
        });
    }

    public override appendChild(child: ColumnViewChild): void {
        super.appendChild(child);

        if (child instanceof ListItemNode || child instanceof ListSectionNode) {
            this.list.appendChild(child);
            return;
        }

        if (!(child instanceof ColumnViewColumnNode)) return;

        const existingColumn = this.findColumnInView(child.getColumn());

        if (existingColumn) {
            this.container.removeColumn(existingColumn);
        }

        if (this.list.isFlatMode()) {
            child.setFlatStore(this.list.getFlatStore());
        } else {
            child.setStore(this.list.getStore());
        }
        child.setEstimatedRowHeight(this.estimatedRowHeight);
        this.container.appendColumn(child.getColumn());
        child.attachToColumnView(this.container);
        this.columnNodes.add(child);
    }

    public override insertBefore(child: ColumnViewChild, before: ColumnViewChild): void {
        super.insertBefore(child, before);

        if (child instanceof ListItemNode || child instanceof ListSectionNode) {
            if (before instanceof ListItemNode || before instanceof ListSectionNode) {
                this.list.insertBefore(child, before);
            }
            return;
        }

        if (!(child instanceof ColumnViewColumnNode)) return;

        const existingColumn = this.findColumnInView(child.getColumn());

        if (existingColumn) {
            this.container.removeColumn(existingColumn);
        }

        if (this.list.isFlatMode()) {
            child.setFlatStore(this.list.getFlatStore());
        } else {
            child.setStore(this.list.getStore());
        }
        child.setEstimatedRowHeight(this.estimatedRowHeight);

        if (before instanceof ColumnViewColumnNode) {
            const beforeIndex = this.getColumnIndex(before.getColumn());
            this.container.insertColumn(beforeIndex, child.getColumn());
        } else {
            this.container.appendColumn(child.getColumn());
        }

        child.attachToColumnView(this.container);
        this.columnNodes.add(child);
    }

    public override removeChild(child: ColumnViewChild): void {
        if (child instanceof ListItemNode || child instanceof ListSectionNode) {
            this.list.removeChild(child);
            super.removeChild(child);
            return;
        }

        if (child instanceof ColumnViewColumnNode) {
            child.detachFromColumnView();

            const existingColumn = this.findColumnInView(child.getColumn());

            if (existingColumn) {
                this.container.removeColumn(existingColumn);
            }

            child.setStore(null);
            this.columnNodes.delete(child);
        }

        super.removeChild(child);
    }

    public override finalizeInitialChildren(props: ColumnViewProps): boolean {
        super.finalizeInitialChildren(props);
        return true;
    }

    public override commitUpdate(oldProps: ColumnViewProps | null, newProps: ColumnViewProps): void {
        super.commitUpdate(oldProps ? filterProps(oldProps, OWN_PROPS) : null, filterProps(newProps, OWN_PROPS));
        this.applyOwnProps(oldProps, newProps);

        const previousModel = this.list.getSelectionModel();
        this.list.updateProps(oldProps ? filterProps(oldProps, OWN_PROPS) : null, filterProps(newProps, OWN_PROPS));
        const currentModel = this.list.getSelectionModel();

        if (previousModel !== currentModel) {
            this.container.setModel(currentModel);
        }
    }

    public override commitMount(): void {
        super.commitMount();
        this.list.flushBatch();
        this.container.setModel(this.list.getSelectionModel());
    }

    public override detachDeletedInstance(): void {
        this.columnNodes.clear();
        this.headerRenderer?.dispose();
        super.detachDeletedInstance();
    }

    private applyOwnProps(oldProps: ColumnViewProps | null, newProps: ColumnViewProps): void {
        if (hasChanged(oldProps, newProps, "onSortChanged")) {
            const sorter = this.container.getSorter();
            const onSortChanged = newProps.onSortChanged;

            if (sorter instanceof Gtk.ColumnViewSorter) {
                const handleSortChange = onSortChanged
                    ? () => {
                          onSortChanged(sorter.getPrimarySortColumn()?.getId() ?? null, sorter.getPrimarySortOrder());
                      }
                    : undefined;

                this.signalStore.set(this, sorter, "changed", handleSortChange);
            }
        }

        if (hasChanged(oldProps, newProps, "sortColumn") || hasChanged(oldProps, newProps, "sortOrder")) {
            const sortColumn = newProps.sortColumn;
            const sortOrder = newProps.sortOrder ?? Gtk.SortType.ASCENDING;

            if (!sortColumn) {
                this.container.sortByColumn(sortOrder, undefined);
            } else {
                this.container.sortByColumn(sortOrder, this.getColumn(sortColumn));
            }
        }

        if (hasChanged(oldProps, newProps, "estimatedRowHeight")) {
            this.estimatedRowHeight = newProps.estimatedRowHeight ?? null;
            for (const column of this.columnNodes) {
                column.setEstimatedRowHeight(this.estimatedRowHeight);
            }
        }

        if (hasChanged(oldProps, newProps, "renderHeader")) {
            this.headerRenderer = updateHeaderRenderer(
                this.headerRenderer,
                {
                    signalStore: this.signalStore,
                    isEnabled: () => this.list.isFlatMode(),
                    resolveItem: (id) => this.list.getFlatStore().getHeaderValue(id),
                    setFactory: (factory) => this.container.setHeaderFactory(factory),
                },
                newProps.renderHeader,
            );
        }
    }

    private findColumn<T>(predicate: (column: Gtk.ColumnViewColumn, index: number) => T | null): T | null {
        const columns = this.container.getColumns();
        for (let i = 0; i < columns.getNItems(); i++) {
            const column = columns.getObject(i);
            if (!(column instanceof Gtk.ColumnViewColumn)) continue;
            const result = predicate(column, i);
            if (result !== null) return result;
        }
        return null;
    }

    private getColumn(columnId: string): Gtk.ColumnViewColumn {
        const column = this.findColumn((col) => (col.getId() === columnId ? col : null));
        if (!column) {
            throw new Error(`Unable to find column '${columnId}' in ${this.typeName}`);
        }
        return column;
    }

    private getColumnIndex(column: Gtk.ColumnViewColumn): number {
        const targetId = column.getId();
        const index = this.findColumn((col, i) => (col.getId() === targetId ? i : null));
        if (index === null) {
            throw new Error(`Unable to find column '${targetId}' in ${this.typeName}`);
        }
        return index;
    }

    private findColumnInView(column: Gtk.ColumnViewColumn): Gtk.ColumnViewColumn | null {
        const targetId = column.getId();
        return this.findColumn((col) => (col.getId() === targetId ? col : null));
    }
}

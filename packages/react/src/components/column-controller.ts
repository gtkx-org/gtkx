import * as Gtk from "@gtkx/gi/gtk";
import type { ReactNode } from "react";
import { BoundContainerRegistry } from "../reconciler/bound-container-registry.js";
import { type BoundItem, collectFlatBoundItems } from "../reconciler/bound-item.js";
import { connectFactoryLifecycle } from "../reconciler/list-factory.js";

const UNREGISTERED_ITEM_SIZE = { width: -1, height: -1 } as const;

export interface ColumnHost {
    addColumn(column: ColumnController): void;
    removeColumn(column: ColumnController): void;
    queueBoundItemsUpdate(): void;
    scheduleBoundItemsUpdate(): void;
    getEstimatedItemSize(): { width: number; height: number };
}

type CellRenderer = (item: unknown) => ReactNode;

export class ColumnController {
    public factory: Gtk.SignalListItemFactory;
    private registry = new BoundContainerRegistry<Gtk.ListItem>();
    private list: ColumnHost | null = null;
    private renderCell: CellRenderer | null = null;

    public constructor() {
        this.factory = new Gtk.SignalListItemFactory();
        connectFactoryLifecycle<Gtk.ListItem>(this.factory, {
            registry: this.registry,
            itemClass: Gtk.ListItem,
            createContainer: (item) => item,
            resolveContainer: (item) => item,
            getPosition: (item) => item.getPosition(),
            onBoundItemsChanged: () => this.list?.queueBoundItemsUpdate(),
            onSetup: (item) => {
                const placeholder = new Gtk.Box();
                const { width, height } = this.list?.getEstimatedItemSize() ?? UNREGISTERED_ITEM_SIZE;
                placeholder.setSizeRequest(width, height);
                item.setChild(placeholder);
            },
        });
    }

    public register(list: ColumnHost): void {
        if (this.list === list) return;
        this.list = list;
        list.addColumn(this);
    }

    public unregister(): void {
        if (!this.list) return;
        this.list.removeColumn(this);
        this.list = null;
    }

    public setRenderCell(renderCell: CellRenderer | null): void {
        if (this.renderCell === renderCell) return;
        this.renderCell = renderCell;
        this.list?.scheduleBoundItemsUpdate();
    }

    public teardown(): void {
        this.registry.clear();
    }

    public collectBoundItems(resolveItem: (position: number) => unknown): BoundItem[] {
        const renderCell = this.renderCell;
        if (!renderCell) return [];

        const items: BoundItem[] = [];
        collectFlatBoundItems({
            registry: this.registry,
            resolveItem,
            render: renderCell,
            out: items,
        });
        return items;
    }
}

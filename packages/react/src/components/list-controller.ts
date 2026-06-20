import type * as Gio from "@gtkx/gi/gio";
import type * as GObject from "@gtkx/gi/gobject";
import * as Gtk from "@gtkx/gi/gtk";
import { createElement, type ReactNode } from "react";
import { type BoundItem, collectFlatBoundItems } from "../reconciler/bound-item.js";
import { isInCommit, scheduleFlush } from "../reconciler/commit-flush.js";
import { runDeferredFlush } from "../reconciler/deferred-flush.js";
import { connectFactoryLifecycle, UNBOUND_POSITION } from "../reconciler/list-factory.js";
import { ListModelController } from "../reconciler/list-model-controller.js";
import { SelectionController } from "../reconciler/selection-controller.js";
import { SignalStore } from "../reconciler/signal-store.js";
import type { ListItem } from "../utils/element-props.js";
import type { DropDownLike } from "../utils/gtype-predicates.js";
import type { ColumnController, ColumnHost } from "./column-controller.js";
import { ColumnViewLifecycle } from "./column-view-lifecycle.js";

export type ListItemRenderer = (item: unknown, row?: Gtk.TreeListRow | null) => ReactNode;

export type ListHeaderRenderer = (item: unknown) => ReactNode;

export interface ListControllerProps {
    items?: ListItem[];
    model?: Gio.ListModel;
    renderItem?: ListItemRenderer | null;
    renderListItem?: ListItemRenderer | null;
    renderHeader?: ListHeaderRenderer | null;
    autoexpand?: boolean;
    selected?: string[] | null;
    onSelectionChanged?: ((ids: string[]) => void) | ((id: string) => void) | null;
    selectionMode?: Gtk.SelectionMode | null;
    selectedId?: string | null;
    sortColumn?: string | null;
    sortOrder?: Gtk.SortType | null;
    onSortChanged?: ((column: string | null, order: Gtk.SortType) => void) | null;
    estimatedItemHeight?: number;
    estimatedItemWidth?: number;
    estimatedRowHeight?: number | null;
}

export class ListController implements ColumnHost {
    private modelController = new ListModelController({
        getItems: () => this.getItems(),
        getAutoexpand: () => this.getAutoexpand(),
        isDropDown: () => this.isDropDown(),
        assignBaseModelToSelection: (model) => this.selectionController.assignBaseModel(model),
        assignModelToWidget: () => this.assignModelToWidget(),
        scheduleBoundItemsUpdate: () => this.queueBoundItemsUpdate(),
    });
    private selectionController: SelectionController;
    private signals = new SignalStore();
    private signalOwner = { signalStore: this.signals };
    private factory: Gtk.SignalListItemFactory | null = null;
    private headerFactory: Gtk.SignalListItemFactory | null = null;
    private listFactory: Gtk.SignalListItemFactory | null = null;
    private containers = new Map<Gtk.Widget | Gtk.ListItem, number>();
    private containerKeys = new Map<Gtk.Widget | Gtk.ListItem, string>();
    private headerContainers = new Map<Gtk.ListHeader, number>();
    private headerContainerKeys = new Map<Gtk.ListHeader, string>();
    private listContainers = new Map<Gtk.ListItem, number>();
    private listContainerKeys = new Map<Gtk.ListItem, string>();
    private treeExpanders = new Map<Gtk.ListItem, Gtk.TreeExpander>();
    private columnView: ColumnViewLifecycle | null;
    private boundItems: BoundItem[] = [];
    private headerBoundItems: BoundItem[] = [];
    private detached = false;
    private boundItemsUpdateScheduled = false;
    private widget: Gtk.Widget;
    private dropDown: DropDownLike | null;
    private props: ListControllerProps;
    private requestRerender: () => void;

    constructor(
        widget: Gtk.Widget,
        dropDown: DropDownLike | null,
        props: ListControllerProps,
        requestRerender: () => void,
    ) {
        this.widget = widget;
        this.dropDown = dropDown;
        this.props = props;
        this.requestRerender = requestRerender;
        this.selectionController = new SelectionController(this.signalOwner, this.widget, this.modelController, {
            isDropDown: () => this.isDropDown(),
            assignModelToWidget: () => this.assignModelToWidget(),
            getOnSelectionChanged: () => this.props.onSelectionChanged,
            setDropDownSelected: (position) => this.dropDown?.setSelected(position),
            getDropDownSelected: () => this.dropDown?.getSelected() ?? -1,
        });
        this.columnView =
            this.widget instanceof Gtk.ColumnView
                ? new ColumnViewLifecycle(this.signalOwner, this.widget, {
                      isUncontrolled: () => this.isUncontrolled(),
                      isDetached: () => this.detached,
                      assignModelToWidget: () => this.assignModelToWidget(),
                      assignUncontrolledModelToWidget: () => this.assignUncontrolledModelToWidget(),
                      applySelection: () => this.selectionController.applySelection(this.props.selected ?? null),
                      applySelectedId: () => this.selectionController.applySelectedId(this.props.selectedId),
                      scheduleBoundItemsUpdate: () => this.scheduleBoundItemsUpdate(),
                      getSortColumn: () => this.props.sortColumn,
                      getSortOrder: () => this.props.sortOrder,
                      getOnSortChanged: () => this.props.onSortChanged,
                  })
                : null;
    }

    public getBoundItems(): BoundItem[] {
        return this.boundItems;
    }

    public getHeaderBoundItems(): BoundItem[] {
        return this.headerBoundItems;
    }

    public attach(): void {
        const columnView = this.columnView;
        if (this.isUncontrolled()) {
            this.setupFactory();
            this.assignFactoryToWidget();
            if (!columnView) this.assignUncontrolledModelToWidget();
        } else {
            this.modelController.setupModel();
            this.setupFactory();
            if (this.props.renderHeader) this.setupHeaderFactory();
            this.selectionController.setup(this.props.selectionMode);
            this.modelController.syncModel();
            if (!columnView) this.assignModelToWidget();
            this.assignFactoryToWidget();
        }
        this.connectInteractionSignals();
        if (!this.isUncontrolled() && !columnView) {
            this.selectionController.applySelection(this.props.selected ?? null);
            this.selectionController.applySelectedId(this.props.selectedId);
        }
        columnView?.settle();
    }

    public update(oldProps: ListControllerProps, newProps: ListControllerProps): void {
        this.props = newProps;
        if (this.isUncontrolled()) {
            this.applyUncontrolledProps(oldProps, newProps);
        } else {
            this.applyControlledProps(oldProps, newProps);
        }
    }

    public dispose(): void {
        this.detached = true;
        this.treeExpanders.clear();
        this.modelController.detach();
        this.signals.clear(this.signalOwner);
        this.columnView?.clearColumns();
    }

    public addColumn(column: ColumnController): void {
        this.columnView?.addColumn(column);
    }

    public removeColumn(column: ColumnController): void {
        this.columnView?.removeColumn(column);
    }

    public scheduleColumnSettle(): void {
        this.columnView?.scheduleSettle();
    }

    public isDropDown(): boolean {
        return this.dropDown !== null;
    }

    public getEstimatedItemSize(): { width: number; height: number } {
        return {
            width: this.props.estimatedItemWidth ?? -1,
            height: this.props.estimatedItemHeight ?? this.props.estimatedRowHeight ?? -1,
        };
    }

    public scheduleBoundItemsUpdate(): void {
        this.requestBoundItemsUpdate(queueMicrotask);
    }

    public queueBoundItemsUpdate(): void {
        this.requestBoundItemsUpdate(setImmediate);
    }

    private requestBoundItemsUpdate(defer: (flush: () => void) => void): void {
        if (this.detached || this.boundItemsUpdateScheduled) return;
        this.boundItemsUpdateScheduled = true;
        if (isInCommit()) {
            scheduleFlush(this.flushBoundItemsUpdate);
        } else {
            defer(this.deferredBoundItemsFlush);
        }
    }

    private deferredBoundItemsFlush = (): void => {
        runDeferredFlush(this.flushBoundItemsUpdate);
    };

    private getItems(): ListItem[] {
        return this.props.items ?? [];
    }

    private getAutoexpand(): boolean {
        return this.props.autoexpand ?? false;
    }

    private isUncontrolled(): boolean {
        return this.props.model != null;
    }

    private connectInteractionSignals(): void {
        if (this.isUncontrolled()) return;
        this.selectionController.connectSelectionSignal();
        this.columnView?.connectSortSignal();
    }

    private setupFactory(): void {
        if (this.columnView) return;

        this.factory = new Gtk.SignalListItemFactory();
        const isTree = this.modelController.isTreeMode();

        connectFactoryLifecycle<Gtk.ListItem, Gtk.Widget | Gtk.ListItem>(this.factory, {
            containers: this.containers,
            containerKeys: this.containerKeys,
            createContainer: (item) => (isTree ? this.createTreeContainer(item) : this.createFlatContainer(item)),
            resolveContainer: (item) => (isTree ? (this.treeExpanders.get(item) ?? null) : item),
            getPosition: (item) => item.getPosition(),
            resolvePosition: (item, reported) => this.resolveBindPosition(item, reported),
            onBoundItemsChanged: () => this.queueBoundItemsUpdate(),
            onBind: (item, _container, position) => {
                if (isTree) this.bindTreeExpander(item, position);
            },
            onUnbind: (_item, container) => {
                if (container instanceof Gtk.TreeExpander) container.setListRow(null);
            },
            onTeardown: (item) => {
                if (isTree) this.treeExpanders.delete(item);
            },
            isDetached: () => this.detached,
        });

        if (this.props.renderListItem && this.isDropDown()) {
            this.setupListFactory();
        }
    }

    private createTreeContainer(listItem: Gtk.ListItem): Gtk.TreeExpander {
        const expander = new Gtk.TreeExpander();
        listItem.setChild(expander);
        this.treeExpanders.set(listItem, expander);
        return expander;
    }

    private createFlatContainer(listItem: Gtk.ListItem): Gtk.ListItem {
        const { width, height } = this.getEstimatedItemSize();
        if (width !== -1 || height !== -1) {
            const placeholder = new Gtk.Box();
            placeholder.setSizeRequest(width, height);
            listItem.setChild(placeholder);
        }
        return listItem;
    }

    private resolveBindPosition(listItem: Gtk.ListItem, reported: number): number {
        if (!this.isDropDown() || this.isUncontrolled()) return reported;
        const item = listItem.getItem();
        if (!item) return reported;
        return this.modelController.positionOf(item) ?? reported;
    }

    private bindTreeExpander(listItem: Gtk.ListItem, position: number): void {
        const expander = this.treeExpanders.get(listItem);
        if (!expander) return;

        const row = listItem.getItem();
        if (!(row instanceof Gtk.TreeListRow)) return;
        expander.setListRow(row);
        this.applyEstimatedItemSize(expander);

        const treeItem = this.modelController.resolveTreeItem(row);
        if (treeItem) {
            this.applyTreeExpanderProps(expander, treeItem);
        }

        this.containers.set(expander, position);
    }

    private setupListFactory(): void {
        this.listFactory = new Gtk.SignalListItemFactory();
        connectFactoryLifecycle<Gtk.ListItem>(this.listFactory, {
            containers: this.listContainers,
            containerKeys: this.listContainerKeys,
            createContainer: (item) => item,
            resolveContainer: (item) => item,
            getPosition: (item) => item.getPosition(),
            onBoundItemsChanged: () => this.queueBoundItemsUpdate(),
            isDetached: () => this.detached,
        });
    }

    private setupHeaderFactory(): void {
        this.headerFactory = new Gtk.SignalListItemFactory();
        connectFactoryLifecycle<Gtk.ListHeader>(this.headerFactory, {
            containers: this.headerContainers,
            containerKeys: this.headerContainerKeys,
            createContainer: (item) => item,
            resolveContainer: (item) => item,
            getPosition: (item) => item.getStart(),
            onBoundItemsChanged: () => this.queueBoundItemsUpdate(),
            isDetached: () => this.detached,
        });
    }

    private assignModelToWidget(): void {
        const widget = this.widget;

        if (this.dropDown) {
            const dropDownModel = this.modelController.hasSections()
                ? (this.modelController.flattenModel as Gio.ListModel)
                : (this.modelController.model as Gio.ListModel);
            this.dropDown.setModel(dropDownModel);
            return;
        }

        const selectionModel = this.selectionController.selectionModel;
        if (!selectionModel) return;

        if (widget instanceof Gtk.ListView || widget instanceof Gtk.GridView || widget instanceof Gtk.ColumnView) {
            widget.setModel(selectionModel);
        }
    }

    private assignUncontrolledModelToWidget(): void {
        const widget = this.widget;
        const model = this.props.model;
        if (!model) return;
        if (this.dropDown) {
            this.dropDown.setModel(model);
            return;
        }
        if (widget instanceof Gtk.ListView || widget instanceof Gtk.GridView || widget instanceof Gtk.ColumnView) {
            widget.setModel(model as Gtk.SelectionModel);
        }
    }

    private assignFactoryToWidget(): void {
        const widget = this.widget;

        if (this.dropDown) {
            this.dropDown.setFactory(this.factory);
            this.applyListAndHeaderFactories(this.dropDown);
            return;
        }
        if (widget instanceof Gtk.ListView) {
            widget.setFactory(this.factory);
            this.applyHeaderFactory(widget);
        } else if (widget instanceof Gtk.ColumnView) {
            this.applyHeaderFactory(widget);
        } else if (widget instanceof Gtk.GridView) {
            widget.setFactory(this.factory);
        }
    }

    private applyHeaderFactory(widget: Gtk.ListView | Gtk.ColumnView): void {
        if (this.headerFactory) {
            widget.setHeaderFactory(this.headerFactory);
        }
    }

    private applyListAndHeaderFactories(dropDown: DropDownLike): void {
        if (this.listFactory) dropDown.setListFactory(this.listFactory);
        if (this.headerFactory) dropDown.setHeaderFactory(this.headerFactory);
    }

    private applyTreeExpanderProps(expander: Gtk.TreeExpander, item: ListItem): void {
        if (item.section) return;
        expander.setIndentForDepth(item.indentForDepth ?? true);
        expander.setIndentForIcon(item.indentForIcon ?? true);
        expander.setHideExpander(item.hideExpander ?? false);
    }

    private applyUncontrolledProps(oldProps: ListControllerProps, newProps: ListControllerProps): void {
        if (oldProps.model !== newProps.model) {
            this.assignUncontrolledModelToWidget();
            this.queueBoundItemsUpdate();
        }
        if (oldProps.renderItem !== newProps.renderItem || oldProps.renderListItem !== newProps.renderListItem) {
            this.scheduleBoundItemsUpdate();
        }
    }

    private applyControlledProps(oldProps: ListControllerProps, newProps: ListControllerProps): void {
        if (oldProps.items !== newProps.items) {
            this.modelController.syncModel();
        }

        this.applySelectionProps(oldProps, newProps);

        if (
            oldProps.renderItem !== newProps.renderItem ||
            oldProps.renderListItem !== newProps.renderListItem ||
            oldProps.renderHeader !== newProps.renderHeader
        ) {
            this.scheduleBoundItemsUpdate();
        }

        if (oldProps.autoexpand !== newProps.autoexpand && this.modelController.treeModel) {
            this.modelController.setAutoexpand(newProps.autoexpand ?? false);
        }

        if (oldProps.onSortChanged !== newProps.onSortChanged) {
            this.columnView?.connectSortSignal();
        }

        if (oldProps.sortColumn !== newProps.sortColumn || oldProps.sortOrder !== newProps.sortOrder) {
            this.columnView?.applySortColumn();
        }
    }

    private applySelectionProps(oldProps: ListControllerProps, newProps: ListControllerProps): void {
        const selectionModeChanged = oldProps.selectionMode !== newProps.selectionMode;
        if (selectionModeChanged) {
            this.selectionController.rebuild(newProps.selectionMode);
        }

        if (selectionModeChanged || oldProps.selected !== newProps.selected) {
            this.selectionController.applySelection(newProps.selected ?? null);
        }

        if (selectionModeChanged || oldProps.selectedId !== newProps.selectedId) {
            this.selectionController.applySelectedId(newProps.selectedId);
        }

        if (oldProps.onSelectionChanged !== newProps.onSelectionChanged) {
            this.selectionController.connectSelectionSignal();
        }
    }

    private flushBoundItemsUpdate = (): void => {
        this.boundItemsUpdateScheduled = false;
        if (this.detached) return;
        this.rebuildBoundItems();
    };

    private collectStandardBoundItems(resolveItem: (position: number) => unknown): BoundItem[] {
        const { renderItem, renderListItem } = this.props;
        const newBoundItems: BoundItem[] = [];
        const labelItem = (item: unknown): ReactNode =>
            createElement("GtkLabel", { label: typeof item === "string" ? item : "" });
        const renderFn = renderItem ?? (this.isDropDown() ? labelItem : null);

        if (renderFn !== null) {
            this.collectContainerBoundItems({
                containers: this.containers,
                containerKeys: this.containerKeys,
                resolveItem,
                renderFn,
                out: newBoundItems,
            });
        }

        if (renderListItem && this.isDropDown()) {
            this.collectContainerBoundItems({
                containers: this.listContainers,
                containerKeys: this.listContainerKeys,
                resolveItem,
                renderFn: renderListItem,
                out: newBoundItems,
            });
        }

        return newBoundItems;
    }

    private collectHeaderBoundItemsForSection(
        section: ListItem,
        sectionStart: number,
        renderHeader: NonNullable<ListControllerProps["renderHeader"]>,
        out: BoundItem[],
    ): void {
        for (const [container, position] of this.headerContainers) {
            if (position === UNBOUND_POSITION || position !== sectionStart) continue;
            const key = this.headerContainerKeys.get(container);
            if (!key) continue;
            out.push([renderHeader(section.value), container, key]);
        }
    }

    private collectAllHeaderBoundItems(renderHeader: NonNullable<ListControllerProps["renderHeader"]>): BoundItem[] {
        const sections = this.modelController.collectSections();
        const headerBoundItems: BoundItem[] = [];
        let sectionStart = 0;

        for (const section of sections) {
            this.collectHeaderBoundItemsForSection(section, sectionStart, renderHeader, headerBoundItems);
            sectionStart += section.children?.length ?? 0;
        }

        return headerBoundItems;
    }

    private rebuildBoundItems(): void {
        const { renderHeader } = this.props;
        const resolveItem = this.buildItemResolver();
        const newBoundItems = this.columnView
            ? this.columnView.collectBoundItems(resolveItem)
            : this.collectStandardBoundItems(resolveItem);

        this.boundItems = newBoundItems;

        if (renderHeader && this.modelController.hasSectionStore()) {
            this.headerBoundItems = this.collectAllHeaderBoundItems(renderHeader);
        } else {
            this.headerBoundItems = [];
        }

        this.requestRerender();
    }

    private buildItemResolver(): (position: number) => unknown {
        if (this.isUncontrolled()) {
            const model = this.props.model;
            return (position: number) => model?.getItem(position) ?? null;
        }
        const flatItems = this.modelController.collectFlatItems();
        return (position: number) => flatItems[position]?.value;
    }

    private collectContainerBoundItems(args: {
        containers: Map<GObject.Object, number>;
        containerKeys: Map<GObject.Object, string>;
        resolveItem: (position: number) => unknown;
        renderFn: (item: unknown, row?: Gtk.TreeListRow | null) => ReactNode;
        out: BoundItem[];
    }): void {
        const { containers, containerKeys, resolveItem, renderFn, out } = args;
        if (this.modelController.treeModel === null) {
            collectFlatBoundItems(containers, containerKeys, resolveItem, renderFn, out);
            return;
        }

        for (const [container, position] of containers) {
            if (position === UNBOUND_POSITION) continue;
            const key = containerKeys.get(container);
            if (!key) continue;
            this.appendTreeBoundItem({ container, key, renderFn, out });
        }
    }

    private appendTreeBoundItem(args: {
        container: GObject.Object;
        key: string;
        renderFn: (item: unknown, row?: Gtk.TreeListRow | null) => ReactNode;
        out: BoundItem[];
    }): void {
        const { container, key, renderFn, out } = args;
        const expander = container as Gtk.TreeExpander;
        const row = expander.getListRow() ?? null;
        if (!row) return;
        const item = this.modelController.resolveTreeItem(row);
        if (!item) return;
        out.push([renderFn(item.value, row), container, key]);
    }

    private applyEstimatedItemSize(widget: Gtk.Widget): void {
        const { width, height } = this.getEstimatedItemSize();
        widget.setSizeRequest(width, height);
    }
}

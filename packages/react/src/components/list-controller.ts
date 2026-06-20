import type * as Gio from "@gtkx/gi/gio";
import type * as GObject from "@gtkx/gi/gobject";
import * as Gtk from "@gtkx/gi/gtk";
import { createElement, type ReactNode } from "react";
import { type BoundItem, collectFlatBoundItems } from "../reconciler/bound-item.js";
import { isInCommit, scheduleFlush } from "../reconciler/commit-flush.js";
import { runDeferredFlush } from "../reconciler/deferred-flush.js";
import { asLifecycleItem, connectFactoryLifecycle, UNBOUND_POSITION } from "../reconciler/list-factory.js";
import { ListModelController } from "../reconciler/list-model-controller.js";
import { SelectionController } from "../reconciler/selection-controller.js";
import { SignalStore } from "../reconciler/signal-store.js";
import { stableIdOf } from "../reconciler/stable-id.js";
import type { ListItem } from "../utils/element-props.js";
import type { DropDownLike } from "../utils/gtype-predicates.js";
import type { ColumnController, ColumnHost } from "./column-controller.js";
import { ColumnViewLifecycle } from "./column-view-lifecycle.js";

/** Renders one bound row; `row` carries tree state for hierarchical lists. */
export type ListItemRenderer = (item: unknown, row?: Gtk.TreeListRow | null) => ReactNode;

/** Renders one bound section header. */
export type ListHeaderRenderer = (item: unknown) => ReactNode;

/**
 * The props a {@link ListController} reads. This is the union of every public
 * list-variant prop the controller acts on, kept structural so the controller
 * does not depend on the per-variant JSX prop types.
 */
export interface ListControllerProps {
    /** Controlled-mode data items. */
    items?: ListItem[];
    /** Uncontrolled-mode `Gio.ListModel` handed straight to the widget. */
    model?: Gio.ListModel;
    /** Renders the primary cell/item content. */
    renderItem?: ListItemRenderer | null;
    /** Renders the dropdown popup-list item, overriding `renderItem` there. */
    renderListItem?: ListItemRenderer | null;
    /** Renders a section header. */
    renderHeader?: ListHeaderRenderer | null;
    /** Whether tree rows expand automatically. */
    autoexpand?: boolean;
    /** Controlled selected item ids. */
    selected?: string[] | null;
    /** Fired when the user changes the selection. */
    onSelectionChanged?: ((ids: string[]) => void) | ((id: string) => void) | null;
    /** Selection behavior. */
    selectionMode?: Gtk.SelectionMode | null;
    /** Controlled dropdown selected id. */
    selectedId?: string | null;
    /** Id of the sorted column, or null for no sorting (column view). */
    sortColumn?: string | null;
    /** Sort direction (column view). */
    sortOrder?: Gtk.SortType | null;
    /** Fired when the sort column or order changes (column view). */
    onSortChanged?: ((column: string | null, order: Gtk.SortType) => void) | null;
    /** Estimated item height in pixels for virtualization. */
    estimatedItemHeight?: number;
    /** Estimated item width in pixels for virtualization. */
    estimatedItemWidth?: number;
    /** Estimated row height in pixels for virtualization (column view). */
    estimatedRowHeight?: number | null;
}

/**
 * Drives one virtualized list widget (`GtkListView`/`GtkGridView`/
 * `GtkColumnView`/`GtkDropDown`/`AdwComboRow`) from a hand-written component.
 *
 * It owns the backing GTK models (flat/tree/section), the selection model, the
 * `Gtk.SignalListItemFactory` instances that map rows to React-rendered cells,
 * and the bound-item lists the component renders as portals. The component
 * instantiates one controller per widget, calls {@link attach} once the widget
 * ref settles, {@link update} on every prop change, and {@link dispose} on
 * unmount. Whenever the visible bound items change the controller invokes the
 * `requestRerender` callback so the component re-renders its portals.
 */
export class ListController implements ColumnHost {
    private readonly modelController = new ListModelController({
        getItems: () => this.getItems(),
        getAutoexpand: () => this.getAutoexpand(),
        isDropDown: () => this.isDropDown(),
        assignBaseModelToSelection: (model) => this.selectionController.assignBaseModel(model),
        assignModelToWidget: () => this.assignModelToWidget(),
        scheduleBoundItemsUpdate: () => this.queueBoundItemsUpdate(),
    });
    private readonly selectionController: SelectionController;
    private readonly signals = new SignalStore();
    private readonly signalOwner = { signalStore: this.signals };
    private factory: Gtk.SignalListItemFactory | null = null;
    private headerFactory: Gtk.SignalListItemFactory | null = null;
    private listFactory: Gtk.SignalListItemFactory | null = null;
    private readonly containers = new Map<Gtk.Widget | Gtk.ListItem, number>();
    private readonly containerKeys = new Map<Gtk.Widget | Gtk.ListItem, string>();
    private readonly headerContainers = new Map<Gtk.ListHeader, number>();
    private readonly headerContainerKeys = new Map<Gtk.ListHeader, string>();
    private readonly listContainers = new Map<Gtk.ListItem, number>();
    private readonly listContainerKeys = new Map<Gtk.ListItem, string>();
    private readonly treeExpanders = new Map<Gtk.ListItem, Gtk.TreeExpander>();
    private readonly columnView: ColumnViewLifecycle | null;
    private boundItems: BoundItem[] = [];
    private headerBoundItems: BoundItem[] = [];
    private detached = false;
    private boundItemsUpdateScheduled = false;

    /**
     * @param widget - The backing list widget this controller drives.
     * @param dropDown - The widget's dropdown surface when it is a dropdown-style
     *   widget (`Gtk.DropDown`/`Adw.ComboRow`), resolved by the owning component;
     *   `null` for list/grid/column views.
     * @param props - The widget's initial props.
     * @param requestRerender - Invoked when the visible bound items change so the
     *   owning component re-renders its portals.
     */
    constructor(
        private readonly widget: Gtk.Widget,
        private readonly dropDown: DropDownLike | null,
        private props: ListControllerProps,
        private readonly requestRerender: () => void,
    ) {
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

    /** The backing list widget this controller drives. */
    public getWidget(): Gtk.Widget {
        return this.widget;
    }

    /** The widget's current bound-item list (one portal per visible cell). */
    public getBoundItems(): BoundItem[] {
        return this.boundItems;
    }

    /** The widget's current header bound-item list (one portal per visible header). */
    public getHeaderBoundItems(): BoundItem[] {
        return this.headerBoundItems;
    }

    /**
     * Builds the models, factories, and selection, then assigns them to the
     * widget. Runs once when the component first sees the widget.
     */
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

    /** Applies a prop change, re-syncing models, factories, and selection. */
    public update(oldProps: ListControllerProps, newProps: ListControllerProps): void {
        this.props = newProps;
        if (this.isUncontrolled()) {
            this.applyUncontrolledProps(oldProps, newProps);
        } else {
            this.applyControlledProps(oldProps, newProps);
        }
    }

    /** Releases every model signal, factory, expander, and column registration. */
    public dispose(): void {
        this.detached = true;
        this.treeExpanders.clear();
        this.modelController.detach();
        this.signals.clear(this.signalOwner);
        this.columnView?.clearColumns();
    }

    /** Registers a column controller so the controller can collect its cells. */
    public addColumn(column: ColumnController): void {
        this.columnView?.addColumn(column);
    }

    /** Unregisters a column controller. */
    public removeColumn(column: ColumnController): void {
        this.columnView?.removeColumn(column);
    }

    /**
     * Schedules the column-view settle work to run once after every column
     * mutation of the current commit applies.
     */
    public scheduleColumnSettle(): void {
        this.columnView?.scheduleSettle();
    }

    /** Whether this controller drives a dropdown-style widget. */
    public isDropDown(): boolean {
        return this.dropDown !== null;
    }

    /** The estimated per-item size used to seed placeholder cells. */
    public getEstimatedItemSize(): { width: number; height: number } {
        return {
            width: this.props.estimatedItemWidth ?? -1,
            height: this.props.estimatedItemHeight ?? this.props.estimatedRowHeight ?? -1,
        };
    }

    /**
     * Requests a bound-item refresh after the current change settles.
     *
     * Inside a React commit the flush is queued onto the post-commit queue so it
     * drains within the same `act` boundary; otherwise it defers to a microtask
     * that runs the flush through the installed deferred-flush wrapper.
     */
    public scheduleBoundItemsUpdate(): void {
        this.requestBoundItemsUpdate(queueMicrotask);
    }

    /**
     * Requests a bound-item refresh, used by factory lifecycle callbacks.
     *
     * When a GTK factory binds during a React commit, the flush is queued onto
     * the post-commit queue so the rendered cells land within the same `act`
     * boundary; outside a commit it defers to a macrotask that runs the flush
     * through the installed deferred-flush wrapper.
     */
    public queueBoundItemsUpdate(): void {
        this.requestBoundItemsUpdate(setImmediate);
    }

    /**
     * Schedules a single bound-item flush, guarding against a detached
     * controller and a flush already pending. Inside a React commit the flush is
     * queued onto the post-commit queue so it drains within the same `act`
     * boundary; otherwise `defer` schedules the deferred flush onto its task
     * queue (a microtask or a macrotask).
     *
     * @param defer - Schedules the deferred flush off the commit, e.g. `queueMicrotask`.
     */
    private requestBoundItemsUpdate(defer: (flush: () => void) => void): void {
        if (this.detached || this.boundItemsUpdateScheduled) return;
        this.boundItemsUpdateScheduled = true;
        if (isInCommit()) {
            scheduleFlush(this.flushBoundItemsUpdate);
        } else {
            defer(this.deferredBoundItemsFlush);
        }
    }

    private readonly deferredBoundItemsFlush = (): void => {
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

        this.factory.on("setup", (obj: GObject.Object) => this.onFactorySetup(obj, isTree));
        this.factory.on("bind", (obj: GObject.Object) => this.onFactoryBind(obj, isTree));
        this.factory.on("unbind", (obj: GObject.Object) => this.onFactoryUnbind(obj, isTree));
        this.factory.on("teardown", (obj: GObject.Object) => this.onFactoryTeardown(obj, isTree));

        if (this.props.renderListItem && this.isDropDown()) {
            this.setupListFactory();
        }
    }

    private onFactorySetup(obj: GObject.Object, isTree: boolean): void {
        const listItem = asLifecycleItem<Gtk.ListItem>(obj);

        if (isTree) {
            const expander = new Gtk.TreeExpander();
            listItem.setChild(expander);
            this.containers.set(expander, UNBOUND_POSITION);
            this.containerKeys.set(expander, stableIdOf(expander));
            this.treeExpanders.set(listItem, expander);
            return;
        }

        const { width, height } = this.getEstimatedItemSize();
        if (width !== -1 || height !== -1) {
            const placeholder = new Gtk.Box();
            placeholder.setSizeRequest(width, height);
            listItem.setChild(placeholder);
        }
        this.containers.set(listItem, UNBOUND_POSITION);
        this.containerKeys.set(listItem, stableIdOf(listItem));
    }

    private lifecycleListItem(obj: GObject.Object): Gtk.ListItem | null {
        if (this.detached) return null;
        return asLifecycleItem<Gtk.ListItem>(obj);
    }

    private withTreeExpander(listItem: Gtk.ListItem, fn: (expander: Gtk.TreeExpander) => void): void {
        const expander = this.treeExpanders.get(listItem);
        if (expander) fn(expander);
    }

    private onFactoryBind(obj: GObject.Object, isTree: boolean): void {
        const listItem = this.lifecycleListItem(obj);
        if (!listItem) return;
        const position = this.resolveBindPosition(listItem);

        if (isTree) {
            this.bindTreeListItem(listItem, position);
        } else {
            this.containers.set(listItem, position);
        }

        this.queueBoundItemsUpdate();
    }

    /**
     * Resolves the flat position a factory binding addresses. Dropdown-like
     * widgets resolve through the bound object's identity because
     * `Adw.ComboRow` binds its selected-item display without assigning the
     * list item a position, leaving `getPosition()` stuck at `0`.
     */
    private resolveBindPosition(listItem: Gtk.ListItem): number {
        const position = listItem.getPosition();
        if (!this.isDropDown() || this.isUncontrolled()) return position;
        const item = listItem.getItem();
        if (!item) return position;
        return this.modelController.positionOf(item) ?? position;
    }

    private bindTreeListItem(listItem: Gtk.ListItem, position: number): void {
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

    private withLifecycleItem(
        obj: GObject.Object,
        isTree: boolean,
        onTreeExpander: (expander: Gtk.TreeExpander) => void,
        onFlatItem: (listItem: Gtk.ListItem) => void,
    ): Gtk.ListItem | null {
        const listItem = this.lifecycleListItem(obj);
        if (!listItem) return null;

        if (isTree) {
            this.withTreeExpander(listItem, onTreeExpander);
        } else {
            onFlatItem(listItem);
        }

        return listItem;
    }

    private onFactoryUnbind(obj: GObject.Object, isTree: boolean): void {
        const listItem = this.withLifecycleItem(
            obj,
            isTree,
            (expander) => {
                this.containers.set(expander, UNBOUND_POSITION);
                expander.setListRow(null);
            },
            (item) => {
                this.containers.set(item, UNBOUND_POSITION);
            },
        );
        if (listItem) this.queueBoundItemsUpdate();
    }

    private onFactoryTeardown(obj: GObject.Object, isTree: boolean): void {
        const listItem = this.withLifecycleItem(
            obj,
            isTree,
            (expander) => {
                this.containers.delete(expander);
                this.containerKeys.delete(expander);
            },
            (item) => {
                this.containers.delete(item);
                this.containerKeys.delete(item);
            },
        );
        if (!listItem) return;
        if (isTree) this.treeExpanders.delete(listItem);
        listItem.setChild(null);
    }

    private setupListFactory(): void {
        this.listFactory = new Gtk.SignalListItemFactory();
        connectFactoryLifecycle(this.listFactory, {
            containers: this.listContainers,
            containerKeys: this.listContainerKeys,
            getPosition: (item) => item.getPosition(),
            onBoundItemsChanged: () => this.queueBoundItemsUpdate(),
            isDetached: () => this.detached,
        });
    }

    private setupHeaderFactory(): void {
        this.headerFactory = new Gtk.SignalListItemFactory();
        connectFactoryLifecycle(this.headerFactory, {
            containers: this.headerContainers,
            containerKeys: this.headerContainerKeys,
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

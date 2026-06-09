import type * as Adw from "@gtkx/gi/adw";
import type * as Gio from "@gtkx/gi/gio";
import type * as GObject from "@gtkx/gi/gobject";
import * as Gtk from "@gtkx/gi/gtk";
import type { ReactNode } from "react";
import { isInCommit, scheduleFlush } from "../../commit-flush.js";
import { isAdwComboRow } from "../../gtype-predicates.js";
import type { ListItem } from "../../jsx.js";
import type { BoundItem } from "../../nodes/internal/bound-item.js";
import { asLifecycleItem, connectFactoryLifecycle, UNBOUND_POSITION } from "../../nodes/internal/list-factory.js";
import { ListModelController } from "../../nodes/internal/list-model-controller.js";
import { SelectionController } from "../../nodes/internal/selection-controller.js";
import { SignalStore } from "../../nodes/internal/signal-store.js";
import { stableIdOf } from "../../nodes/internal/stable-id.js";
import type { BackingInstance } from "../../types.js";
import type { ColumnController } from "./column-controller.js";
import { deleteColumnViewController, getColumnController } from "./column-view-registry.js";

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
export class ListController {
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
    private readonly columns = new Set<ColumnController>();
    private boundItems: BoundItem[] = [];
    private headerBoundItems: BoundItem[] = [];
    private detached = false;
    private boundItemsUpdateScheduled = false;
    private columnViewModelAssigned = false;

    /**
     * @param widget - The backing list widget this controller drives.
     * @param props - The widget's initial props.
     * @param requestRerender - Invoked when the visible bound items change so the
     *   owning component re-renders its portals.
     */
    constructor(
        private readonly widget: Gtk.Widget,
        private props: ListControllerProps,
        private readonly requestRerender: () => void,
    ) {
        this.selectionController = new SelectionController(this.signalOwner, this.widget, this.modelController, {
            isDropDown: () => this.isDropDown(),
            assignModelToWidget: () => this.assignModelToWidget(),
            getOnSelectionChanged: () => this.props.onSelectionChanged,
        });
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
        const isColumnView = this.isColumnView();
        if (this.isUncontrolled()) {
            this.setupFactory();
            this.assignFactoryToWidget();
            if (!isColumnView) this.assignUncontrolledModelToWidget();
        } else {
            this.modelController.setupModel();
            this.setupFactory();
            if (this.props.renderHeader) this.setupHeaderFactory();
            this.selectionController.setup(this.props.selectionMode);
            this.modelController.syncModel();
            if (!isColumnView) this.assignModelToWidget();
            this.assignFactoryToWidget();
        }
        this.connectInteractionSignals();
        if (!this.isUncontrolled() && !isColumnView) {
            this.selectionController.applySelection(this.props.selected ?? null);
            this.selectionController.applySelectedId(this.props.selectedId);
        }
        if (isColumnView) this.adoptExistingColumns();
    }

    /**
     * Registers the controllers of every column already inserted into the column
     * view, then runs the settle so the model and sort apply once. Covers the
     * initial mount, where the columns attach in the commit that builds the view
     * before this controller settles and can be recorded.
     */
    private adoptExistingColumns(): void {
        const columnView = this.widget;
        if (!(columnView instanceof Gtk.ColumnView)) return;
        const columns = columnView.getColumns();
        const nItems = columns.getNItems();
        for (let i = 0; i < nItems; i++) {
            const column = columns.getItem(i);
            if (column instanceof Gtk.ColumnViewColumn) {
                getColumnController(column)?.register(this, columnView);
            }
        }
        this.settleColumns();
    }

    /**
     * Assigns the model and applies the initial selection to a `GtkColumnView`
     * once its columns have been inserted.
     *
     * A column view builds and lays out its cells from its model. Assigning the
     * model while the view still has no columns, then inserting the columns,
     * makes GTK rebuild and recycle those cells mid-insertion, disposing cell
     * widgets that still reference a column and measuring already-freed ones.
     * Deferring the model until the columns are in place builds the cells once,
     * against the final column set, so no cell is recycled during insertion.
     */
    public finishColumnViewAttach(): void {
        if (this.columnViewModelAssigned || !this.isColumnView() || this.detached) return;
        this.columnViewModelAssigned = true;
        if (this.isUncontrolled()) {
            this.assignUncontrolledModelToWidget();
            return;
        }
        this.assignModelToWidget();
        this.selectionController.applySelection(this.props.selected ?? null);
        this.selectionController.applySelectedId(this.props.selectedId);
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
        this.columns.clear();
        if (this.widget instanceof Gtk.ColumnView) deleteColumnViewController(this.widget);
    }

    /** Registers a column controller so the controller can collect its cells. */
    public addColumn(column: ColumnController): void {
        this.columns.add(column);
    }

    /** Unregisters a column controller. */
    public removeColumn(column: ColumnController): void {
        this.columns.delete(column);
    }

    /**
     * Schedules the column-view settle work to run once after every column
     * mutation of the current commit applies. The reconciler inserts and removes
     * columns during the commit's freeze window; queuing the settle through the
     * commit flush (deduped by identity) collapses many column mutations into one
     * settle that sees the final column set.
     */
    public scheduleColumnSettle(): void {
        if (!this.isColumnView() || this.detached) return;
        scheduleFlush(this.settleColumns);
    }

    private settleColumns = (): void => {
        if (this.detached) return;
        const modelWasAssigned = this.columnViewModelAssigned;
        this.finishColumnViewAttach();
        if (modelWasAssigned) this.relayoutColumns();
        this.applySortColumn(this.props);
        this.scheduleBoundItemsUpdate();
    };

    /**
     * Re-inserts every live column in its current order so the column view
     * rebuilds each already-realized row's cells in column order.
     *
     * `Gtk.ColumnView.insertColumn` appends a newly inserted column's cells to the
     * visual end of rows that GTK has already realized, leaving the cells out of
     * logical column order. Removing then re-inserting the whole column set forces
     * GTK to lay every row's cells out in the columns' order. It runs only on a
     * settle after the model is assigned, when realized cells exist; the initial
     * settle builds the cells once against the final column set and needs no
     * relayout.
     */
    private relayoutColumns(): void {
        const columnView = this.widget;
        if (!(columnView instanceof Gtk.ColumnView)) return;
        const columns = columnView.getColumns();
        const ordered: Gtk.ColumnViewColumn[] = [];
        for (let i = 0; i < columns.getNItems(); i++) {
            const column = columns.getItem(i);
            if (column instanceof Gtk.ColumnViewColumn) ordered.push(column);
        }
        for (const column of ordered) columnView.removeColumn(column);
        ordered.forEach((column, index) => {
            columnView.insertColumn(index, column);
        });
    }

    /** Whether this controller drives a dropdown-style widget. */
    public isDropDown(): boolean {
        return this.widget instanceof Gtk.DropDown || isAdwComboRow(this.widget);
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
     * drains within the same `act` boundary; otherwise it defers to a microtask.
     */
    public scheduleBoundItemsUpdate(): void {
        if (this.boundItemsUpdateScheduled) return;
        this.boundItemsUpdateScheduled = true;
        if (isInCommit()) {
            scheduleFlush(this.flushBoundItemsUpdate);
        } else {
            queueMicrotask(this.flushBoundItemsUpdate);
        }
    }

    /**
     * Requests a bound-item refresh, used by factory lifecycle callbacks.
     *
     * When a GTK factory binds during a React commit, the flush is queued onto
     * the post-commit queue so the rendered cells land within the same `act`
     * boundary; outside a commit it defers to the macrotask queue.
     */
    public queueBoundItemsUpdate(): void {
        if (this.detached || this.boundItemsUpdateScheduled) return;
        this.boundItemsUpdateScheduled = true;
        if (isInCommit()) {
            scheduleFlush(this.flushBoundItemsUpdate);
        } else {
            setImmediate(this.flushBoundItemsUpdate);
        }
    }

    private getItems(): ListItem[] {
        return this.props.items ?? [];
    }

    private getAutoexpand(): boolean {
        return this.props.autoexpand ?? false;
    }

    private isUncontrolled(): boolean {
        return this.props.model != null;
    }

    private isColumnView(): boolean {
        return this.widget instanceof Gtk.ColumnView;
    }

    private connectInteractionSignals(): void {
        if (this.isUncontrolled()) return;
        this.selectionController.connectSelectionSignal();
        this.connectSortSignal();
    }

    private setupFactory(): void {
        if (this.isColumnView()) return;

        this.factory = new Gtk.SignalListItemFactory();
        const isTree = this.modelController.isTreeMode();

        this.factory.connect("setup", (obj: GObject.Object) => this.onFactorySetup(obj, isTree));
        this.factory.connect("bind", (obj: GObject.Object) => this.onFactoryBind(obj, isTree));
        this.factory.connect("unbind", (obj: GObject.Object) => this.onFactoryUnbind(obj, isTree));
        this.factory.connect("teardown", (obj: GObject.Object) => this.onFactoryTeardown(obj, isTree));

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
        const position = listItem.getPosition();

        if (isTree) {
            this.bindTreeListItem(listItem, position);
        } else {
            this.containers.set(listItem, position);
        }

        this.queueBoundItemsUpdate();
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

        if (this.isDropDown()) {
            const dropDownModel = this.modelController.hasSections()
                ? (this.modelController.flattenModel as Gio.ListModel)
                : (this.modelController.model as Gio.ListModel);
            if (widget instanceof Gtk.DropDown || isAdwComboRow(widget)) {
                widget.setModel(dropDownModel);
            }
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
        if (widget instanceof Gtk.DropDown || isAdwComboRow(widget)) {
            widget.setModel(model);
            return;
        }
        if (widget instanceof Gtk.ListView || widget instanceof Gtk.GridView || widget instanceof Gtk.ColumnView) {
            widget.setModel(model as Gtk.SelectionModel);
        }
    }

    private assignFactoryToWidget(): void {
        const widget = this.widget;

        if (widget instanceof Gtk.ListView) {
            widget.setFactory(this.factory);
            this.applyHeaderFactory(widget);
        } else if (widget instanceof Gtk.ColumnView) {
            this.applyHeaderFactory(widget);
        } else if (widget instanceof Gtk.GridView) {
            widget.setFactory(this.factory);
        } else if (widget instanceof Gtk.DropDown || isAdwComboRow(widget)) {
            widget.setFactory(this.factory);
            this.applyListAndHeaderFactories(widget);
        }
    }

    private applyHeaderFactory(widget: Gtk.ListView | Gtk.ColumnView): void {
        if (this.headerFactory) {
            widget.setHeaderFactory(this.headerFactory);
        }
    }

    private applyListAndHeaderFactories(widget: Gtk.DropDown | Adw.ComboRow): void {
        if (this.listFactory) widget.setListFactory(this.listFactory);
        if (this.headerFactory) widget.setHeaderFactory(this.headerFactory);
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
            this.connectSortSignal();
        }

        if (oldProps.sortColumn !== newProps.sortColumn || oldProps.sortOrder !== newProps.sortOrder) {
            this.applySortColumn(newProps);
        }
    }

    /**
     * Applies the controlled sort column after columns settle. Called by the
     * component once column controllers have attached their columns, so the
     * `id` lookup against the column view's live column list resolves.
     */
    public applySortColumn(props: ListControllerProps): void {
        if (!this.isColumnView()) return;

        const columnView = this.widget as Gtk.ColumnView;
        const { sortColumn, sortOrder } = props;

        if (sortColumn === null || sortColumn === undefined) {
            columnView.sortByColumn(null, Gtk.SortType.ASCENDING);
            return;
        }

        const column = this.findColumnById(sortColumn);
        if (column) {
            columnView.sortByColumn(column, sortOrder ?? Gtk.SortType.ASCENDING);
        }
    }

    private findColumnById(id: string): Gtk.ColumnViewColumn | null {
        if (!this.isColumnView()) return null;
        const columnView = this.widget as Gtk.ColumnView;
        const columns = columnView.getColumns();
        const nItems = columns.getNItems();

        for (let i = 0; i < nItems; i++) {
            const obj = columns.getItem(i);
            if (obj instanceof Gtk.ColumnViewColumn && obj.getId() === id) {
                return obj;
            }
        }
        return null;
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

    private connectSortSignal(): void {
        if (!this.isColumnView()) return;

        const columnView = this.widget as Gtk.ColumnView;
        const sorter = columnView.getSorter();
        if (!sorter) return;

        const { onSortChanged } = this.props;
        const handler = onSortChanged
            ? () => {
                  const cvSorter = columnView.getSorter();
                  if (!(cvSorter instanceof Gtk.ColumnViewSorter)) {
                      onSortChanged(null, Gtk.SortType.ASCENDING);
                      return;
                  }
                  const primaryColumn = cvSorter.getPrimarySortColumn();
                  const primaryOrder = cvSorter.getPrimarySortOrder();
                  const columnId = primaryColumn?.getId() ?? null;
                  onSortChanged(columnId, primaryOrder);
              }
            : undefined;

        this.signals.set({ owner: this.signalOwner, obj: sorter, signal: "changed", handler, blockable: false });
    }

    private flushBoundItemsUpdate = (): void => {
        this.boundItemsUpdateScheduled = false;
        if (this.detached) return;
        this.rebuildBoundItems();
    };

    private collectColumnViewBoundItems(resolveItem: (position: number) => unknown): BoundItem[] {
        const items: BoundItem[] = [];
        for (const column of this.columns) {
            items.push(...column.collectBoundItems(resolveItem));
        }
        return items;
    }

    private collectStandardBoundItems(resolveItem: (position: number) => unknown): BoundItem[] {
        const { renderItem, renderListItem } = this.props;
        const newBoundItems: BoundItem[] = [];
        const stringifyItem = (item: unknown): string => (typeof item === "string" ? item : "");
        const renderFn = renderItem ?? (this.isDropDown() ? stringifyItem : null);

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
        const newBoundItems = this.isColumnView()
            ? this.collectColumnViewBoundItems(resolveItem)
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
        containers: Map<BackingInstance, number>;
        containerKeys: Map<BackingInstance, string>;
        resolveItem: (position: number) => unknown;
        renderFn: (item: unknown, row?: Gtk.TreeListRow | null) => ReactNode;
        out: BoundItem[];
    }): void {
        const { containers, containerKeys, resolveItem, renderFn, out } = args;
        const isTree = this.modelController.treeModel !== null;

        for (const [container, position] of containers) {
            if (position === UNBOUND_POSITION) continue;
            const key = containerKeys.get(container);
            if (!key) continue;

            if (isTree) {
                this.appendTreeBoundItem({ container, key, renderFn, out });
            } else {
                this.appendFlatBoundItem({ container, position, key, resolveItem, renderFn, out });
            }
        }
    }

    private appendTreeBoundItem(args: {
        container: BackingInstance;
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

    private appendFlatBoundItem(args: {
        container: BackingInstance;
        position: number;
        key: string;
        resolveItem: (position: number) => unknown;
        renderFn: (item: unknown, row?: Gtk.TreeListRow | null) => ReactNode;
        out: BoundItem[];
    }): void {
        const { container, position, key, resolveItem, renderFn, out } = args;
        const value = resolveItem(position);
        if (value === undefined || value === null) return;
        out.push([renderFn(value), container, key]);
    }

    private applyEstimatedItemSize(widget: Gtk.Widget): void {
        const { width, height } = this.getEstimatedItemSize();
        widget.setSizeRequest(width, height);
    }
}

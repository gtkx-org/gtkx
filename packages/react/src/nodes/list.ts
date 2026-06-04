import * as Adw from "@gtkx/gi/adw";
import type * as Gio from "@gtkx/gi/gio";
import type * as GObject from "@gtkx/gi/gobject";
import * as Gtk from "@gtkx/gi/gtk";
import { omit } from "@gtkx/utils";
import type { ReactNode } from "react";
import type { ListItem } from "../jsx.js";
import type { Node } from "../node.js";
import { isInCommit, scheduleAfterCommit } from "../post-commit-queue.js";
import type { BackingInstance } from "../types.js";
import { ColumnViewColumnNode } from "./column-view-column.js";
import { ContainerSlotNode } from "./container-slot.js";
import { EventControllerNode } from "./event-controller.js";
import type { BoundItem } from "./internal/bound-item.js";
import { asLifecycleItem, connectFactoryLifecycle, UNBOUND_POSITION } from "./internal/list-factory.js";
import { ListModelController } from "./internal/list-model-controller.js";
import { hasChanged } from "./internal/props.js";
import { SelectionController } from "./internal/selection-controller.js";
import { stableIdOf } from "./internal/stable-id.js";
import { SlotNode } from "./slot.js";
import { WidgetNode } from "./widget.js";

type ListItemRenderer = (item: unknown, row?: Gtk.TreeListRow | null) => ReactNode;
type ListHeaderRenderer = (item: unknown) => ReactNode;

type ListProps = {
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
    __boundItemsRef?: { current: BoundItem[] };
    __rerender?: () => void;
    __headerBoundItemsRef?: { current: BoundItem[] };
};

const OWN_PROPS = [
    "items",
    "model",
    "renderItem",
    "renderListItem",
    "renderHeader",
    "autoexpand",
    "selected",
    "onSelectionChanged",
    "selectionMode",
    "selectedId",
    "sortColumn",
    "sortOrder",
    "onSortChanged",
    "estimatedItemHeight",
    "estimatedItemWidth",
    "estimatedRowHeight",
    "__boundItemsRef",
    "__rerender",
    "__headerBoundItemsRef",
] as const;

type ListChild = ColumnViewColumnNode | EventControllerNode | SlotNode | ContainerSlotNode;

export class ListNode extends WidgetNode<Gtk.Widget, ListProps, ListChild> {
    private readonly modelController = new ListModelController(this);
    private readonly selectionController = new SelectionController(
        this,
        this.backingInstance,
        this.modelController,
        this,
    );
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
    private detached = false;
    private boundItemsUpdateScheduled = false;
    private syncScheduled = false;

    public override isValidChild(child: Node): boolean {
        return (
            child instanceof ColumnViewColumnNode ||
            child instanceof EventControllerNode ||
            child instanceof SlotNode ||
            child instanceof ContainerSlotNode
        );
    }

    public override appendChild(child: ListChild): void {
        const isMove = child instanceof ColumnViewColumnNode && this.hasChild(child);
        super.appendChild(child);
        if (child instanceof ColumnViewColumnNode) {
            const columnView = this.backingInstance as Gtk.ColumnView;
            if (isMove) {
                columnView.removeColumn(child.getColumn());
            } else {
                child.installActionGroup(columnView);
            }
            columnView.appendColumn(child.getColumn());
        }
    }

    public override removeChild(child: ListChild): void {
        if (child instanceof ColumnViewColumnNode) {
            const columnView = this.backingInstance as Gtk.ColumnView;
            columnView.removeColumn(child.getColumn());
            child.uninstallActionGroup(columnView);
        }
        super.removeChild(child);
    }

    public override insertBefore(child: ListChild, before: ListChild): void {
        const isMove = child instanceof ColumnViewColumnNode && this.hasChild(child);
        super.insertBefore(child, before);
        if (child instanceof ColumnViewColumnNode) {
            const columnView = this.backingInstance as Gtk.ColumnView;
            if (isMove) {
                columnView.removeColumn(child.getColumn());
            } else {
                child.installActionGroup(columnView);
            }
            const position = this.getColumnPosition(child);
            columnView.insertColumn(position, child.getColumn());
        }
    }

    public override finalizeInitialChildren(props: ListProps): boolean {
        this.commitUpdate(null, props);
        if (this.isUncontrolled()) {
            this.setupFactory();
            this.assignFactoryToWidget();
            this.assignUncontrolledModelToWidget();
            return true;
        }
        this.modelController.setupModel();
        this.setupFactory();
        if (this.props.renderHeader && !this.isDropDown()) {
            this.setupHeaderFactory();
        }
        this.selectionController.setup(this.props.selectionMode);
        this.assignModelToWidget();
        this.assignFactoryToWidget();
        this.modelController.syncModel();
        return true;
    }

    public override commitUpdate(oldProps: ListProps | null, newProps: ListProps): void {
        super.commitUpdate(oldProps ? omit(oldProps, OWN_PROPS) : null, omit(newProps, OWN_PROPS));
        this.props = newProps;
        if (oldProps === null) return;
        this.applyOwnProps(oldProps, newProps);
    }

    public override commitMount(): void {
        if (this.isUncontrolled()) return;
        this.selectionController.connectSelectionSignal();
        this.connectSortSignal();
        this.selectionController.applySelection(this.props.selected ?? null);
        this.selectionController.applySelectedId(this.props.selectedId);
    }

    public override detachDeletedInstance(): void {
        this.detached = true;
        this.treeExpanders.clear();
        this.modelController.detach();
        super.detachDeletedInstance();
    }

    public getItems(): ListItem[] {
        return this.props.items ?? [];
    }

    public getAutoexpand(): boolean {
        return this.props.autoexpand ?? false;
    }

    public getOnSelectionChanged(): ListProps["onSelectionChanged"] {
        return this.props.onSelectionChanged;
    }

    public isDropDown(): boolean {
        return this.backingInstance instanceof Gtk.DropDown || this.backingInstance instanceof Adw.ComboRow;
    }

    private isColumnView(): boolean {
        return this.backingInstance instanceof Gtk.ColumnView;
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

        const row = listItem.getItem() as Gtk.TreeListRow;
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

    public assignBaseModelToSelection(model: Gio.ListModel): void {
        this.selectionController.assignBaseModel(model);
    }

    public assignModelToWidget(): void {
        const widget = this.backingInstance;

        if (this.isDropDown()) {
            const dropDownModel = this.modelController.hasSections()
                ? (this.modelController.flattenModel as Gio.ListModel)
                : (this.modelController.model as Gio.ListModel);
            if (widget instanceof Gtk.DropDown || widget instanceof Adw.ComboRow) {
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

    private isUncontrolled(): boolean {
        return this.props.model != null;
    }

    private assignUncontrolledModelToWidget(): void {
        const widget = this.backingInstance;
        const model = this.props.model;
        if (!model) return;
        if (widget instanceof Gtk.DropDown || widget instanceof Adw.ComboRow) {
            widget.setModel(model);
            return;
        }
        if (widget instanceof Gtk.ListView || widget instanceof Gtk.GridView || widget instanceof Gtk.ColumnView) {
            widget.setModel(model as Gtk.SelectionModel);
        }
    }

    private assignFactoryToWidget(): void {
        const widget = this.backingInstance;

        if (widget instanceof Gtk.ListView) {
            widget.setFactory(this.factory);
            this.applyHeaderFactory(widget);
        } else if (widget instanceof Gtk.ColumnView) {
            this.applyHeaderFactory(widget);
        } else if (widget instanceof Gtk.GridView) {
            widget.setFactory(this.factory);
        } else if (widget instanceof Gtk.DropDown || widget instanceof Adw.ComboRow) {
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

    private applyUncontrolledOwnProps(oldProps: ListProps, newProps: ListProps): void {
        if (hasChanged(oldProps, newProps, "model")) {
            this.assignUncontrolledModelToWidget();
            this.queueBoundItemsUpdate();
        }
        if (hasChanged(oldProps, newProps, "renderItem") || hasChanged(oldProps, newProps, "renderListItem")) {
            this.scheduleBoundItemsUpdate();
        }
    }

    private applyControlledOwnProps(oldProps: ListProps, newProps: ListProps): void {
        if (hasChanged(oldProps, newProps, "items")) {
            this.scheduleSync();
        }

        this.applySelectionProps(oldProps, newProps);

        if (
            hasChanged(oldProps, newProps, "renderItem") ||
            hasChanged(oldProps, newProps, "renderListItem") ||
            hasChanged(oldProps, newProps, "renderHeader")
        ) {
            this.scheduleBoundItemsUpdate();
        }

        if (hasChanged(oldProps, newProps, "autoexpand") && this.modelController.treeModel) {
            this.modelController.setAutoexpand(newProps.autoexpand ?? false);
        }

        if (hasChanged(oldProps, newProps, "onSortChanged")) {
            this.connectSortSignal();
        }

        if (hasChanged(oldProps, newProps, "sortColumn") || hasChanged(oldProps, newProps, "sortOrder")) {
            this.applySortColumn(newProps);
        }
    }

    private applySelectionProps(oldProps: ListProps, newProps: ListProps): void {
        const selectionModeChanged = hasChanged(oldProps, newProps, "selectionMode");
        if (selectionModeChanged) {
            this.selectionController.rebuild(newProps.selectionMode);
        }

        if (selectionModeChanged || hasChanged(oldProps, newProps, "selected")) {
            this.selectionController.applySelection(newProps.selected ?? null);
        }

        if (selectionModeChanged || hasChanged(oldProps, newProps, "selectedId")) {
            this.selectionController.applySelectedId(newProps.selectedId);
        }

        if (hasChanged(oldProps, newProps, "onSelectionChanged")) {
            this.selectionController.connectSelectionSignal();
        }
    }

    private applyOwnProps(oldProps: ListProps, newProps: ListProps): void {
        if (this.isUncontrolled()) {
            this.applyUncontrolledOwnProps(oldProps, newProps);
        } else {
            this.applyControlledOwnProps(oldProps, newProps);
        }
    }

    private connectSortSignal(): void {
        if (!this.isColumnView()) return;

        const columnView = this.backingInstance as Gtk.ColumnView;
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

        this.signalStore.set({ owner: this, obj: sorter, signal: "changed", handler, blockable: false });
    }

    private applySortColumn(props: ListProps): void {
        if (!this.isColumnView()) return;

        const columnView = this.backingInstance as Gtk.ColumnView;
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
        const columnView = this.backingInstance as Gtk.ColumnView;
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

    private scheduleSync(): void {
        if (this.syncScheduled) return;
        this.syncScheduled = true;

        scheduleAfterCommit(() => {
            this.syncScheduled = false;
            if (this.detached) return;
            this.modelController.syncModel();
        });
    }

    public scheduleBoundItemsUpdate(): void {
        if (this.boundItemsUpdateScheduled) return;
        this.boundItemsUpdateScheduled = true;
        scheduleAfterCommit(this.flushBoundItemsUpdate);
    }

    public queueBoundItemsUpdate(): void {
        if (this.detached || this.boundItemsUpdateScheduled) return;
        this.boundItemsUpdateScheduled = true;
        if (isInCommit()) {
            scheduleAfterCommit(this.flushBoundItemsUpdate);
        } else {
            setImmediate(this.flushBoundItemsUpdate);
        }
    }

    private flushBoundItemsUpdate = (): void => {
        this.boundItemsUpdateScheduled = false;
        if (this.detached) return;
        this.rebuildBoundItems();
    };

    private collectColumnViewBoundItems(resolveItem: (position: number) => unknown): BoundItem[] {
        const items: BoundItem[] = [];
        for (const child of this.children) {
            if (child instanceof ColumnViewColumnNode) {
                items.push(...child.collectBoundItems(resolveItem));
            }
        }
        return items;
    }

    private collectStandardBoundItems(
        resolveItem: (position: number) => unknown,
        renderItem: ListProps["renderItem"],
        renderListItem: ListProps["renderListItem"],
    ): BoundItem[] {
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
        renderHeader: NonNullable<ListProps["renderHeader"]>,
        out: BoundItem[],
    ): void {
        for (const [container, position] of this.headerContainers) {
            if (position === UNBOUND_POSITION || position !== sectionStart) continue;
            const key = this.headerContainerKeys.get(container);
            if (!key) continue;
            out.push([renderHeader(section.value), container, key]);
        }
    }

    private collectAllHeaderBoundItems(renderHeader: NonNullable<ListProps["renderHeader"]>): BoundItem[] {
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
        const { __boundItemsRef, __rerender, __headerBoundItemsRef, renderItem, renderListItem, renderHeader } =
            this.props;
        if (!__boundItemsRef || !__rerender) return;

        const resolveItem = this.buildItemResolver();
        const newBoundItems = this.isColumnView()
            ? this.collectColumnViewBoundItems(resolveItem)
            : this.collectStandardBoundItems(resolveItem, renderItem, renderListItem);

        __boundItemsRef.current = newBoundItems;

        if (__headerBoundItemsRef && renderHeader && this.modelController.hasSectionStore()) {
            __headerBoundItemsRef.current = this.collectAllHeaderBoundItems(renderHeader);
        }

        __rerender();
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

    public getEstimatedItemSize(): { width: number; height: number } {
        return {
            width: this.props.estimatedItemWidth ?? -1,
            height: this.props.estimatedItemHeight ?? this.props.estimatedRowHeight ?? -1,
        };
    }

    private applyEstimatedItemSize(widget: Gtk.Widget): void {
        const { width, height } = this.getEstimatedItemSize();
        widget.setSizeRequest(width, height);
    }

    private getColumnPosition(columnNode: ColumnViewColumnNode): number {
        let columnIndex = 0;
        for (const child of this.children) {
            if (child === columnNode) return columnIndex;
            if (child instanceof ColumnViewColumnNode) columnIndex++;
        }
        return columnIndex;
    }
}

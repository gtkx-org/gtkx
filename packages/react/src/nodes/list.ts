import * as Adw from "@gtkx/ffi/adw";
import * as Gio from "@gtkx/ffi/gio";
import type * as GObject from "@gtkx/ffi/gobject";
import * as Gtk from "@gtkx/ffi/gtk";
import type { ReactNode } from "react";
import type { ListItem } from "../jsx.js";
import type { Node } from "../node.js";
import { isInCommit, scheduleAfterCommit } from "../post-commit-queue.js";
import type { Container } from "../types.js";
import { ColumnViewColumnNode } from "./column-view-column.js";
import { ContainerSlotNode } from "./container-slot.js";
import { EventControllerNode } from "./event-controller.js";
import type { BoundItem } from "./internal/bound-item.js";
import { asLifecycleItem, connectFactoryLifecycle, UNBOUND_POSITION } from "./internal/list-factory.js";
import { filterProps, hasChanged } from "./internal/props.js";
import { widgetIdOf } from "./internal/widget-id.js";
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
    "renderCell",
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

function resizeStringList(model: Gtk.StringList, newSize: number): void {
    const oldSize = model.getNItems();
    if (newSize > oldSize) {
        model.splice(oldSize, 0, new Array(newSize - oldSize).fill(""));
    } else if (newSize < oldSize) {
        model.splice(newSize, oldSize - newSize, []);
    }
}

export class ListNode extends WidgetNode<Gtk.Widget, ListProps, ListChild> {
    private model: Gtk.StringList | null = null;
    private selectionModel: Gtk.SingleSelection | Gtk.MultiSelection | Gtk.NoSelection | null = null;
    private treeModel: Gtk.TreeListModel | null = null;
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
    private disposed = false;
    private boundItemsUpdateScheduled = false;
    private syncScheduled = false;
    private modeCacheItems: readonly ListItem[] | null = null;
    private modeCacheValue: "sections" | "tree" | "flat" = "flat";
    private readonly sectionModels: Gtk.StringList[] = [];
    private sectionStore: Gio.ListStore | null = null;
    private flattenModel: Gtk.FlattenListModel | null = null;
    private readonly treeChildModels = new Map<string, Gtk.StringList>();
    private rootItemIds: string[] = [];

    public override isValidChild(child: Node): boolean {
        return (
            child instanceof ColumnViewColumnNode ||
            child instanceof EventControllerNode ||
            child instanceof SlotNode ||
            child instanceof ContainerSlotNode
        );
    }

    public override appendChild(child: ListChild): void {
        const isMove = child instanceof ColumnViewColumnNode && this.children.includes(child);
        super.appendChild(child);
        if (child instanceof ColumnViewColumnNode) {
            const columnView = this.container as Gtk.ColumnView;
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
            const columnView = this.container as Gtk.ColumnView;
            columnView.removeColumn(child.getColumn());
            child.uninstallActionGroup(columnView);
        }
        super.removeChild(child);
    }

    public override insertBefore(child: ListChild, before: ListChild): void {
        const isMove = child instanceof ColumnViewColumnNode && this.children.includes(child);
        super.insertBefore(child, before);
        if (child instanceof ColumnViewColumnNode) {
            const columnView = this.container as Gtk.ColumnView;
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
        this.setupModel();
        this.setupFactory();
        if (this.props.renderHeader && !this.isDropDown()) {
            this.setupHeaderFactory();
        }
        this.setupSelectionModel(props);
        this.assignModelToWidget();
        this.assignFactoryToWidget();
        this.syncModel();
        return true;
    }

    public override commitUpdate(oldProps: ListProps | null, newProps: ListProps): void {
        super.commitUpdate(oldProps ? filterProps(oldProps, OWN_PROPS) : null, filterProps(newProps, OWN_PROPS));
        this.props = newProps;
        if (oldProps === null) return;
        this.applyOwnProps(oldProps, newProps);
    }

    public override commitMount(): void {
        if (this.isUncontrolled()) return;
        this.connectSelectionSignal();
        this.connectSortSignal();
        this.applySelection(this.props.selected ?? null);
        this.applySelectedId(this.props.selectedId ?? null);
    }

    public override detachDeletedInstance(): void {
        this.disposed = true;
        this.treeExpanders.clear();
        this.rootItemIds = [];
        super.detachDeletedInstance();
    }

    private getItems(): ListItem[] {
        return this.props.items ?? [];
    }

    private collectFlatItems(): ListItem[] {
        const items = this.getItems();
        if (this.detectMode() === "flat") return items;

        const flat: ListItem[] = [];
        for (const item of items) {
            if (item.section && item.children) {
                for (const child of item.children) {
                    flat.push(child);
                }
            } else {
                flat.push(item);
            }
        }
        return flat;
    }

    private collectSections(): ListItem[] {
        const items = this.getItems();
        const sections: ListItem[] = [];
        for (const item of items) {
            if (item.section) {
                sections.push(item);
            }
        }
        return sections;
    }

    private collectRootItems(): ListItem[] {
        return this.getItems().filter((item) => !item.section);
    }

    private isDropDown(): boolean {
        return this.container instanceof Gtk.DropDown || this.container instanceof Adw.ComboRow;
    }

    private isColumnView(): boolean {
        return this.container instanceof Gtk.ColumnView;
    }

    private detectMode(): "sections" | "tree" | "flat" {
        const items = this.getItems();
        if (items === this.modeCacheItems) return this.modeCacheValue;

        let mode: "sections" | "tree" | "flat" = "flat";
        for (const item of items) {
            if (item.section) {
                mode = "sections";
                break;
            }
            if (item.children && item.children.length > 0) {
                mode = "tree";
                break;
            }
        }
        this.modeCacheItems = items;
        this.modeCacheValue = mode;
        return mode;
    }

    private hasSections(): boolean {
        return this.getItems().some((item) => item.section);
    }

    private isTreeMode(): boolean {
        const items = this.getItems();
        for (const item of items) {
            if (!item.section && item.children && item.children.length > 0) return true;
        }
        return false;
    }

    private setupModel(): void {
        this.model = new Gtk.StringList();
    }

    private setupFactory(): void {
        if (this.isColumnView()) return;

        this.factory = new Gtk.SignalListItemFactory();
        const isTree = this.isTreeMode();

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
            this.containerKeys.set(expander, widgetIdOf(expander));
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
        this.containerKeys.set(listItem, widgetIdOf(listItem));
    }

    private onFactoryBind(obj: GObject.Object, isTree: boolean): void {
        if (this.disposed) return;
        const listItem = asLifecycleItem<Gtk.ListItem>(obj);
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

        const treeItem = this.resolveTreeItem(row);
        if (treeItem) {
            this.applyTreeExpanderProps(expander, treeItem);
        }

        this.containers.set(expander, position);
    }

    private onFactoryUnbind(obj: GObject.Object, isTree: boolean): void {
        if (this.disposed) return;
        const listItem = asLifecycleItem<Gtk.ListItem>(obj);

        if (isTree) {
            const expander = this.treeExpanders.get(listItem);
            if (expander) {
                this.containers.set(expander, UNBOUND_POSITION);
                expander.setListRow(null);
            }
        } else {
            this.containers.set(listItem, UNBOUND_POSITION);
        }

        this.queueBoundItemsUpdate();
    }

    private onFactoryTeardown(obj: GObject.Object, isTree: boolean): void {
        if (this.disposed) return;
        const listItem = asLifecycleItem<Gtk.ListItem>(obj);

        if (isTree) {
            const expander = this.treeExpanders.get(listItem);
            if (expander) {
                this.containers.delete(expander);
                this.containerKeys.delete(expander);
            }
            this.treeExpanders.delete(listItem);
        } else {
            this.containers.delete(listItem);
            this.containerKeys.delete(listItem);
        }

        listItem.setChild(null);
    }

    private setupListFactory(): void {
        this.listFactory = new Gtk.SignalListItemFactory();
        connectFactoryLifecycle(this.listFactory, {
            containers: this.listContainers,
            containerKeys: this.listContainerKeys,
            getPosition: (item) => item.getPosition(),
            onBoundItemsChanged: () => this.queueBoundItemsUpdate(),
            isDisposed: () => this.disposed,
        });
    }

    private setupHeaderFactory(): void {
        this.headerFactory = new Gtk.SignalListItemFactory();
        connectFactoryLifecycle(this.headerFactory, {
            containers: this.headerContainers,
            containerKeys: this.headerContainerKeys,
            getPosition: (item) => item.getStart(),
            onBoundItemsChanged: () => this.queueBoundItemsUpdate(),
            isDisposed: () => this.disposed,
        });
    }

    private setupSelectionModel(props: ListProps): void {
        if (this.isDropDown()) {
            this.selectionModel = null;
            return;
        }
        this.selectionModel = this.createSelectionModel(props.selectionMode ?? Gtk.SelectionMode.SINGLE);
    }

    private createSelectionModel(
        selectionMode: Gtk.SelectionMode,
    ): Gtk.SingleSelection | Gtk.MultiSelection | Gtk.NoSelection {
        const baseModel = this.getBaseModel();

        if (selectionMode === Gtk.SelectionMode.MULTIPLE) {
            return new Gtk.MultiSelection({ model: baseModel });
        }
        if (selectionMode === Gtk.SelectionMode.NONE) {
            return new Gtk.NoSelection({ model: baseModel });
        }
        const sel = new Gtk.SingleSelection({ model: baseModel });
        sel.setAutoselect(false);
        sel.setCanUnselect(true);
        return sel;
    }

    private assignBaseModelToSelection(model: Gio.ListModel): void {
        const sel = this.selectionModel;
        if (!sel) return;
        if (sel instanceof Gtk.SingleSelection || sel instanceof Gtk.MultiSelection || sel instanceof Gtk.NoSelection) {
            sel.setModel(model);
        }
    }

    private getBaseModel(): Gio.ListModel {
        if (this.treeModel) return this.treeModel;
        if (this.flattenModel) return this.flattenModel;
        return this.model as Gtk.StringList;
    }

    private assignModelToWidget(): void {
        const widget = this.container;

        if (this.isDropDown()) {
            const dropDownModel = this.hasSections()
                ? (this.flattenModel as Gio.ListModel)
                : (this.model as Gio.ListModel);
            if (widget instanceof Gtk.DropDown || widget instanceof Adw.ComboRow) {
                widget.setModel(dropDownModel);
            }
            return;
        }

        if (!this.selectionModel) return;

        if (widget instanceof Gtk.ListView || widget instanceof Gtk.GridView || widget instanceof Gtk.ColumnView) {
            widget.setModel(this.selectionModel);
        }
    }

    private isUncontrolled(): boolean {
        return this.props.model != null;
    }

    private assignUncontrolledModelToWidget(): void {
        const widget = this.container;
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
        const widget = this.container;

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

    private syncModel(): void {
        if (!this.model) return;

        const mode = this.detectMode();

        if (mode === "sections") {
            this.syncSectionModel();
            return;
        }

        if (mode === "tree") {
            this.syncTreeModel();
            return;
        }

        resizeStringList(this.model, this.getItems().length);

        this.scheduleBoundItemsUpdate();
    }

    private initializeTreeModel(rootItems: ListItem[], newSize: number): void {
        if (!this.model) return;
        this.treeChildModels.clear();
        this.model.splice(0, this.model.getNItems(), new Array(newSize).fill(""));
        this.rootItemIds = rootItems.map((item) => item.id);

        this.treeModel = Gtk.TreeListModel.new(
            this.model,
            false,
            this.props.autoexpand ?? false,
            (_item: GObject.Object) => this.createChildModel(_item),
        );

        this.assignBaseModelToSelection(this.treeModel);
        this.scheduleBoundItemsUpdate();
    }

    private collectOverlapTransitions(rootItems: ListItem[], overlap: number): number[] {
        const transitionPositions: number[] = [];

        for (let i = 0; i < overlap; i++) {
            const rootItem = rootItems[i];
            if (rootItem && this.reconcileRootChildModel(rootItem, this.rootItemIds[i])) {
                transitionPositions.push(i);
            }
        }

        return transitionPositions;
    }

    private reconcileRootChildModel(rootItem: ListItem, oldId: string | undefined): boolean {
        const newId = rootItem.id;

        if (oldId !== newId) {
            if (oldId !== undefined) this.treeChildModels.delete(oldId);
            return true;
        }

        const cachedChildModel = this.treeChildModels.get(newId);
        const newChildCount = rootItem.children?.length ?? 0;

        if (cachedChildModel) {
            if (newChildCount > 0) {
                resizeStringList(cachedChildModel, newChildCount);
                return false;
            }
            this.treeChildModels.delete(newId);
            return true;
        }

        return newChildCount > 0;
    }

    private clearRemovedTreeItems(overlap: number, oldSize: number): void {
        for (let i = overlap; i < oldSize; i++) {
            const removedId = this.rootItemIds[i];
            if (removedId !== undefined) this.treeChildModels.delete(removedId);
        }
    }

    private applyTransitionResets(transitionPositions: number[], newSize: number): void {
        if (!this.model) return;
        for (const pos of transitionPositions) {
            if (pos >= newSize) continue;
            this.model.splice(pos, 1, [""]);
        }
    }

    private syncTreeModel(): void {
        if (!this.model) return;

        const rootItems = this.collectRootItems();
        const newSize = rootItems.length;

        if (!this.treeModel) {
            this.initializeTreeModel(rootItems, newSize);
            return;
        }

        const oldSize = this.model.getNItems();
        const overlap = Math.min(oldSize, newSize);

        const transitionPositions = this.collectOverlapTransitions(rootItems, overlap);
        this.clearRemovedTreeItems(overlap, oldSize);
        resizeStringList(this.model, newSize);
        this.applyTransitionResets(transitionPositions, newSize);

        this.rootItemIds = rootItems.map((item) => item.id);
        this.scheduleBoundItemsUpdate();
    }

    private createChildModel(_item: GObject.Object): Gio.ListModel | null {
        const rootItems = this.collectRootItems();
        const position = this.findStringObjectPosition(_item);

        if (position === null || position >= rootItems.length) {
            return null;
        }

        const item = rootItems[position];
        if (!item?.children || item.children.length === 0) {
            return null;
        }

        const childModel = new Gtk.StringList();
        resizeStringList(childModel, item.children.length);
        this.treeChildModels.set(item.id, childModel);
        return childModel;
    }

    private findStringObjectPosition(item: GObject.Object): number | null {
        if (!this.model) return null;
        const nItems = this.model.getNItems();
        for (let i = 0; i < nItems; i++) {
            const obj = this.model.getItem(i);
            if (obj === item) {
                return i;
            }
        }
        return null;
    }

    private syncSectionModel(): void {
        if (!this.model) return;

        const sections = this.collectSections();

        if (!this.sectionStore) {
            this.sectionStore = Gio.ListStore.new(Gtk.StringList.prototype.__gtype__);
            this.flattenModel = new Gtk.FlattenListModel({ model: this.sectionStore });

            this.assignBaseModelToSelection(this.flattenModel);

            if (this.isDropDown()) {
                this.assignModelToWidget();
            }
        }

        while (this.sectionModels.length > sections.length) {
            this.sectionModels.pop();
            this.sectionStore.remove(this.sectionStore.getNItems() - 1);
        }

        for (let i = 0; i < sections.length; i++) {
            const section = sections[i];
            if (section === undefined) continue;
            const itemCount = section.children?.length ?? 0;

            if (i >= this.sectionModels.length) {
                const sectionModel = new Gtk.StringList();
                resizeStringList(sectionModel, itemCount);
                this.sectionModels.push(sectionModel);
                this.sectionStore.append(sectionModel);
            } else {
                const existing = this.sectionModels[i];
                if (existing) resizeStringList(existing, itemCount);
            }
        }

        this.scheduleBoundItemsUpdate();
    }

    private resolveTreeItem(row: Gtk.TreeListRow): ListItem | null {
        if (row.getDepth() === 0) {
            return this.resolveRootTreeItem(row);
        }
        return this.resolveChildTreeItem(row);
    }

    private resolveRootTreeItem(row: Gtk.TreeListRow): ListItem | null {
        const rootItem = row.getItem();
        if (!rootItem) return null;
        const pos = this.findStringObjectPosition(rootItem);
        if (pos === null) return null;
        return this.collectRootItems()[pos] ?? null;
    }

    private resolveChildTreeItem(row: Gtk.TreeListRow): ListItem | null {
        const parentRow = row.getParent();
        if (!parentRow) return null;

        const parentItem = this.resolveTreeItem(parentRow);
        if (!parentItem?.children) return null;

        const childItem = row.getItem();
        if (!childItem) return null;

        return this.findChildItemInRow(parentRow, parentItem.children, childItem);
    }

    private findChildItemInRow(
        parentRow: Gtk.TreeListRow,
        siblings: readonly ListItem[],
        childItem: GObject.Object,
    ): ListItem | null {
        const childModel = parentRow.getChildren();
        if (!childModel) return null;
        for (let j = 0; j < childModel.getNItems(); j++) {
            if (childModel.getItem(j) === childItem) {
                return siblings[j] ?? null;
            }
        }
        return null;
    }

    private applyTreeExpanderProps(expander: Gtk.TreeExpander, item: ListItem): void {
        if (item.section) return;
        expander.setIndentForDepth(item.indentForDepth ?? true);
        expander.setIndentForIcon(item.indentForIcon ?? true);
        expander.setHideExpander(item.hideExpander ?? false);
    }

    private resolveItemIdAtPosition(position: number): string | null {
        if (this.treeModel) {
            const row = this.treeModel.getRow(position);
            const item = row ? this.resolveTreeItem(row) : null;
            return item?.id ?? null;
        }
        const flatItems = this.collectFlatItems();
        return flatItems[position]?.id ?? null;
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

        if (hasChanged(oldProps, newProps, "selected")) {
            this.applySelection(newProps.selected ?? null);
        }

        if (hasChanged(oldProps, newProps, "selectedId")) {
            this.applySelectedId(newProps.selectedId ?? null);
        }

        if (hasChanged(oldProps, newProps, "onSelectionChanged")) {
            this.connectSelectionSignal();
        }

        if (hasChanged(oldProps, newProps, "selectionMode")) {
            this.rebuildSelectionModel(newProps);
        }

        if (
            hasChanged(oldProps, newProps, "renderItem") ||
            hasChanged(oldProps, newProps, "renderListItem") ||
            hasChanged(oldProps, newProps, "renderHeader")
        ) {
            this.scheduleBoundItemsUpdate();
        }

        if (hasChanged(oldProps, newProps, "autoexpand") && this.treeModel) {
            this.treeModel.setAutoexpand(newProps.autoexpand ?? false);
        }

        if (hasChanged(oldProps, newProps, "onSortChanged")) {
            this.connectSortSignal();
        }

        if (hasChanged(oldProps, newProps, "sortColumn") || hasChanged(oldProps, newProps, "sortOrder")) {
            this.applySortColumn(newProps);
        }
    }

    private applyOwnProps(oldProps: ListProps, newProps: ListProps): void {
        if (this.isUncontrolled()) {
            this.applyUncontrolledOwnProps(oldProps, newProps);
        } else {
            this.applyControlledOwnProps(oldProps, newProps);
        }
    }

    private rebuildSelectionModel(props: ListProps): void {
        this.selectionModel = this.createSelectionModel(props.selectionMode ?? Gtk.SelectionMode.SINGLE);
        this.assignModelToWidget();
        this.connectSelectionSignal();
    }

    private clearSelection(): void {
        if (this.selectionModel instanceof Gtk.SingleSelection) {
            this.selectionModel.setSelected(Gtk.INVALID_LIST_POSITION);
        } else if (this.selectionModel instanceof Gtk.MultiSelection) {
            this.selectionModel.unselectAll();
        }
    }

    private applySingleSelection(model: Gtk.SingleSelection, idSet: Set<string>): void {
        const nItems = model.getNItems();
        for (let i = 0; i < nItems; i++) {
            const id = this.resolveItemIdAtPosition(i);
            if (id && idSet.has(id)) {
                model.setSelected(i);
                return;
            }
        }
    }

    private applyMultiSelection(model: Gtk.MultiSelection, idSet: Set<string>): void {
        model.unselectAll();
        const nItems = model.getNItems();
        for (let i = 0; i < nItems; i++) {
            const id = this.resolveItemIdAtPosition(i);
            if (id && idSet.has(id)) {
                model.selectItem(i, false);
            }
        }
    }

    private applySelection(ids: string[] | null): void {
        if (!this.selectionModel || this.isDropDown()) return;

        if (!ids || ids.length === 0) {
            this.clearSelection();
            return;
        }

        const idSet = new Set(ids);
        if (this.selectionModel instanceof Gtk.SingleSelection) {
            this.applySingleSelection(this.selectionModel, idSet);
        } else if (this.selectionModel instanceof Gtk.MultiSelection) {
            this.applyMultiSelection(this.selectionModel, idSet);
        }
    }

    private applySelectedId(id: string | null): void {
        if (!this.isDropDown()) return;
        if (id === null || id === undefined) return;

        const flatItems = this.collectFlatItems();
        for (let i = 0; i < flatItems.length; i++) {
            if (flatItems[i]?.id === id) {
                this.setDropDownSelected(i);
                return;
            }
        }
    }

    private setDropDownSelected(position: number): void {
        if (this.container instanceof Gtk.DropDown || this.container instanceof Adw.ComboRow) {
            this.container.setSelected(position);
        }
    }

    private getDropDownSelected(): number {
        if (this.container instanceof Gtk.DropDown || this.container instanceof Adw.ComboRow) {
            return this.container.getSelected();
        }
        return -1;
    }

    private collectTreeSelectionIds(treeModel: Gtk.TreeListModel, selection: Gtk.Bitset, nItems: number): string[] {
        const ids: string[] = [];
        for (let i = 0; i < nItems; i++) {
            if (!selection.contains(i)) continue;
            const row = treeModel.getRow(i);
            const item = row ? this.resolveTreeItem(row) : null;
            if (item) ids.push(item.id);
        }
        return ids;
    }

    private collectFlatSelectionIds(selection: Gtk.Bitset, nItems: number): string[] {
        const ids: string[] = [];
        const flatItems = this.collectFlatItems();
        for (let i = 0; i < nItems; i++) {
            if (!selection.contains(i)) continue;
            const item = flatItems[i];
            if (item) ids.push(item.id);
        }
        return ids;
    }

    private buildDropDownSelectionHandler(onSelectionChanged: (id: string) => void): () => void {
        return () => {
            const position = this.getDropDownSelected();
            const flatItems = this.collectFlatItems();
            const item = flatItems[position];
            if (item) {
                onSelectionChanged(item.id);
            }
        };
    }

    private buildMultiSelectionHandler(onSelectionChanged: (ids: string[]) => void): () => void {
        return () => {
            const selection = this.selectionModel?.getSelection();
            if (!selection) return;
            const nItems = this.selectionModel?.getNItems() ?? 0;
            const ids = this.treeModel
                ? this.collectTreeSelectionIds(this.treeModel, selection, nItems)
                : this.collectFlatSelectionIds(selection, nItems);
            onSelectionChanged(ids);
        };
    }

    private connectSelectionSignal(): void {
        const { onSelectionChanged } = this.props;

        if (this.isDropDown()) {
            const callback = onSelectionChanged as ((id: string) => void) | null | undefined;
            const handler = callback ? this.buildDropDownSelectionHandler(callback) : undefined;
            this.signalStore.set({ owner: this, obj: this.container, signal: "notify::selected", handler });
            return;
        }

        if (!this.selectionModel) return;

        const callback = onSelectionChanged as ((ids: string[]) => void) | null | undefined;
        const handler = callback ? this.buildMultiSelectionHandler(callback) : undefined;

        this.signalStore.set({
            owner: this,
            obj: this.selectionModel,
            signal: "selection-changed",
            handler,
            blockable: false,
        });
    }

    private connectSortSignal(): void {
        if (!this.isColumnView()) return;

        const columnView = this.container as Gtk.ColumnView;
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

        const columnView = this.container as Gtk.ColumnView;
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

    public findColumnById(id: string): Gtk.ColumnViewColumn | null {
        if (!this.isColumnView()) return null;
        const columnView = this.container as Gtk.ColumnView;
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
            if (this.disposed) return;
            this.syncModel();
        });
    }

    public scheduleBoundItemsUpdate(): void {
        if (this.boundItemsUpdateScheduled) return;
        this.boundItemsUpdateScheduled = true;
        scheduleAfterCommit(this.flushBoundItemsUpdate);
    }

    public queueBoundItemsUpdate(): void {
        if (this.disposed || this.boundItemsUpdateScheduled) return;
        this.boundItemsUpdateScheduled = true;
        if (isInCommit()) {
            scheduleAfterCommit(this.flushBoundItemsUpdate);
        } else {
            queueMicrotask(this.flushBoundItemsUpdate);
        }
    }

    private flushBoundItemsUpdate = (): void => {
        this.boundItemsUpdateScheduled = false;
        if (this.disposed) return;
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
        const sections = this.collectSections();
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

        if (__headerBoundItemsRef && renderHeader && this.sectionStore !== null) {
            __headerBoundItemsRef.current = this.collectAllHeaderBoundItems(renderHeader);
        }

        __rerender();
    }

    private buildItemResolver(): (position: number) => unknown {
        if (this.isUncontrolled()) {
            const model = this.props.model;
            return (position: number) => model?.getItem(position) ?? null;
        }
        const flatItems = this.collectFlatItems();
        return (position: number) => flatItems[position]?.value;
    }

    private collectContainerBoundItems(args: {
        containers: Map<Container, number>;
        containerKeys: Map<Container, string>;
        resolveItem: (position: number) => unknown;
        renderFn: (item: unknown, row?: Gtk.TreeListRow | null) => ReactNode;
        out: BoundItem[];
    }): void {
        const { containers, containerKeys, resolveItem, renderFn, out } = args;
        const isTree = this.treeModel !== null;

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
        container: Container;
        key: string;
        renderFn: (item: unknown, row?: Gtk.TreeListRow | null) => ReactNode;
        out: BoundItem[];
    }): void {
        const { container, key, renderFn, out } = args;
        const expander = container as Gtk.TreeExpander;
        const row = expander.getListRow() ?? null;
        if (!row) return;
        const item = this.resolveTreeItem(row);
        if (!item) return;
        out.push([renderFn(item.value, row), container, key]);
    }

    private appendFlatBoundItem(args: {
        container: Container;
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
            height: this.props.estimatedItemHeight ?? -1,
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

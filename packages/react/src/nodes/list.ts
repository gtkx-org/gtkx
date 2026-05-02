import { getNativeId } from "@gtkx/ffi";
import * as Adw from "@gtkx/ffi/adw";
import * as Gio from "@gtkx/ffi/gio";
import type * as GObject from "@gtkx/ffi/gobject";
import * as Gtk from "@gtkx/ffi/gtk";
import type { ReactNode } from "react";
import type { DropDownProps, GridViewProps, ListItem, ListViewProps } from "../jsx.js";
import type { Node } from "../node.js";
import type { Container } from "../types.js";
import { ColumnViewColumnNode } from "./column-view-column.js";
import { ContainerSlotNode } from "./container-slot.js";
import { EventControllerNode } from "./event-controller.js";
import type { BoundItem } from "./internal/bound-item.js";
import { connectFactoryLifecycle, UNBOUND_POSITION } from "./internal/list-factory.js";
import { filterProps, hasChanged } from "./internal/props.js";
import { SlotNode } from "./slot.js";
import { WidgetNode } from "./widget.js";

type ListProps = ListViewProps &
    GridViewProps &
    DropDownProps & {
        __boundItemsRef?: { current: BoundItem[] };
        __rerender?: () => void;
        __headerBoundItemsRef?: { current: BoundItem[] };
        estimatedRowHeight?: number | null;
        sortColumn?: string | null;
        sortOrder?: Gtk.SortType | null;
        onSortChanged?: ((column: string | null, order: Gtk.SortType) => void) | null;
    };

const OWN_PROPS = [
    "items",
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
    private readonly sectionModels: Gtk.StringList[] = [];
    private sectionStore: Gio.ListStore | null = null;
    private flattenModel: Gtk.FlattenListModel | null = null;
    private readonly treeChildModels = new Map<GObject.Object["handle"], Gtk.StringList>();
    private readonly queriedLeaves = new Set<GObject.Object["handle"]>();
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
        this.connectSelectionSignal();
        this.connectSortSignal();
        this.applySelection(this.props.selected ?? null);
        this.applySelectedId(this.props.selectedId ?? null);
    }

    public override detachDeletedInstance(): void {
        this.disposed = true;
        this.treeChildModels.clear();
        this.queriedLeaves.clear();
        this.treeExpanders.clear();
        this.rootItemIds = [];
        super.detachDeletedInstance();
    }

    private getItems(): ListItem[] {
        return this.props.items ?? [];
    }

    private collectFlatItems(): ListItem[] {
        const items = this.getItems();
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
        for (const item of items) {
            if (item.section) return "sections";
            if (item.children && item.children.length > 0) return "tree";
        }
        return "flat";
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

        this.factory.connect("setup", (_self: GObject.Object, obj: GObject.Object) => {
            const listItem = obj as unknown as Gtk.ListItem;

            if (isTree) {
                const expander = new Gtk.TreeExpander();
                listItem.setChild(expander);
                this.containers.set(expander, UNBOUND_POSITION);
                this.containerKeys.set(expander, String(getNativeId(expander.handle)));
                this.treeExpanders.set(listItem, expander);
            } else {
                const { width, height } = this.getEstimatedItemSize();
                if (width !== -1 || height !== -1) {
                    const placeholder = new Gtk.Box();
                    placeholder.setSizeRequest(width, height);
                    listItem.setChild(placeholder);
                }
                this.containers.set(listItem, UNBOUND_POSITION);
                this.containerKeys.set(listItem, String(getNativeId(listItem.handle)));
            }
        });

        this.factory.connect("bind", (_self: GObject.Object, obj: GObject.Object) => {
            if (this.disposed) return;
            const listItem = obj as unknown as Gtk.ListItem;
            const position = listItem.getPosition();

            if (isTree) {
                const expander = this.treeExpanders.get(listItem) as Gtk.TreeExpander;
                const row = (listItem as unknown as { getItem(): GObject.Object | null }).getItem() as Gtk.TreeListRow;
                expander.setListRow(row);
                this.applyEstimatedItemSize(expander);

                const treeItem = this.resolveTreeItem(row);
                if (treeItem) {
                    this.applyTreeExpanderProps(expander, treeItem);
                }

                this.containers.set(expander, position);
            } else {
                this.containers.set(listItem, position);
            }

            this.scheduleBoundItemsUpdate();
        });

        this.factory.connect("unbind", (_self: GObject.Object, obj: GObject.Object) => {
            if (this.disposed) return;
            const listItem = obj as unknown as Gtk.ListItem;

            if (isTree) {
                const expander = this.treeExpanders.get(listItem) as Gtk.TreeExpander;
                this.containers.set(expander, UNBOUND_POSITION);
                expander.setListRow(null);
            } else {
                this.containers.set(listItem, UNBOUND_POSITION);
            }

            this.scheduleBoundItemsUpdate();
        });

        this.factory.connect("teardown", (_self: GObject.Object, obj: GObject.Object) => {
            if (this.disposed) return;
            const listItem = obj as unknown as Gtk.ListItem;

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
        });

        if (this.props.renderListItem && this.isDropDown()) {
            this.setupListFactory();
        }
    }

    private setupListFactory(): void {
        this.listFactory = new Gtk.SignalListItemFactory();
        connectFactoryLifecycle(this.listFactory, {
            containers: this.listContainers,
            containerKeys: this.listContainerKeys,
            getPosition: (item) => item.getPosition(),
            onBoundItemsChanged: () => this.scheduleBoundItemsUpdate(),
            isDisposed: () => this.disposed,
        });
    }

    private setupHeaderFactory(): void {
        this.headerFactory = new Gtk.SignalListItemFactory();
        connectFactoryLifecycle(this.headerFactory, {
            containers: this.headerContainers,
            containerKeys: this.headerContainerKeys,
            getPosition: (item) => item.getStart(),
            onBoundItemsChanged: () => this.scheduleBoundItemsUpdate(),
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
            return new Gtk.MultiSelection(baseModel);
        }
        if (selectionMode === Gtk.SelectionMode.NONE) {
            return new Gtk.NoSelection(baseModel);
        }
        const sel = new Gtk.SingleSelection(baseModel);
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

        const flatItems = this.collectFlatItems();
        resizeStringList(this.model, flatItems.length);

        this.scheduleBoundItemsUpdate();
    }

    private initializeTreeModel(rootItems: ListItem[], newSize: number): void {
        if (!this.model) return;
        this.model.splice(0, this.model.getNItems(), new Array(newSize).fill(""));
        this.rootItemIds = rootItems.map((item) => item.id);

        this.treeModel = new Gtk.TreeListModel(
            this.model as Gio.ListModel,
            false,
            this.props.autoexpand ?? false,
            (_item: GObject.Object) => this.createChildModel(_item),
        );

        this.assignBaseModelToSelection(this.treeModel);
        this.scheduleBoundItemsUpdate();
    }

    private collectOverlapTransitions(rootItems: ListItem[], overlap: number): number[] {
        if (!this.model) return [];
        const transitionPositions: number[] = [];

        for (let i = 0; i < overlap; i++) {
            const obj = this.model.getObject(i);
            if (!obj) continue;

            if (this.rootItemIds[i] !== rootItems[i]?.id) {
                this.treeChildModels.delete(obj.handle);
                this.queriedLeaves.delete(obj.handle);
                transitionPositions.push(i);
                continue;
            }

            const cachedChildModel = this.treeChildModels.get(obj.handle);
            const newChildCount = rootItems[i]?.children?.length ?? 0;

            if (cachedChildModel && newChildCount > 0) {
                resizeStringList(cachedChildModel, newChildCount);
            } else if (cachedChildModel && newChildCount === 0) {
                this.treeChildModels.delete(obj.handle);
                transitionPositions.push(i);
            } else if (!cachedChildModel && newChildCount > 0) {
                transitionPositions.push(i);
            }
        }

        return transitionPositions;
    }

    private clearRemovedTreeItems(overlap: number, oldSize: number): void {
        if (!this.model) return;
        for (let i = overlap; i < oldSize; i++) {
            const obj = this.model.getObject(i);
            if (obj) {
                this.treeChildModels.delete(obj.handle);
                this.queriedLeaves.delete(obj.handle);
            }
        }
    }

    private applyTransitionResets(transitionPositions: number[], newSize: number): void {
        if (!this.model) return;
        for (const pos of transitionPositions) {
            if (pos >= newSize) continue;
            const oldObj = this.model.getObject(pos);
            if (oldObj) {
                this.queriedLeaves.delete(oldObj.handle);
                this.treeChildModels.delete(oldObj.handle);
            }
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
            this.queriedLeaves.add(_item.handle);
            return null;
        }

        const item = rootItems[position];
        if (!item?.children || item.children.length === 0) {
            this.queriedLeaves.add(_item.handle);
            return null;
        }

        const childModel = new Gtk.StringList();
        resizeStringList(childModel, item.children.length);
        this.treeChildModels.set(_item.handle, childModel);
        this.queriedLeaves.delete(_item.handle);
        return childModel;
    }

    private findStringObjectPosition(item: GObject.Object): number | null {
        if (!this.model) return null;
        const nItems = this.model.getNItems();
        for (let i = 0; i < nItems; i++) {
            const obj = this.model.getObject(i);
            if (obj && obj.handle === item.handle) {
                return i;
            }
        }
        return null;
    }

    private syncSectionModel(): void {
        if (!this.model) return;

        const sections = this.collectSections();

        if (!this.sectionStore) {
            this.sectionStore = new Gio.ListStore(Gtk.StringList.getGType());
            this.flattenModel = new Gtk.FlattenListModel(this.sectionStore as unknown as Gio.ListModel);

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
            const section = sections[i] as ListItem;
            const itemCount = section.children?.length ?? 0;

            if (i >= this.sectionModels.length) {
                const sectionModel = new Gtk.StringList();
                resizeStringList(sectionModel, itemCount);
                this.sectionModels.push(sectionModel);
                this.sectionStore.append(sectionModel as unknown as GObject.Object);
            } else {
                resizeStringList(this.sectionModels[i] as Gtk.StringList, itemCount);
            }
        }

        this.scheduleBoundItemsUpdate();
    }

    private resolveTreeItem(row: Gtk.TreeListRow): ListItem | null {
        const rootItems = this.collectRootItems();
        const depth = row.getDepth();

        if (depth === 0) {
            const rootItem = row.getItem();
            if (!rootItem) return null;
            const pos = this.findStringObjectPosition(rootItem);
            if (pos === null) return null;
            return rootItems[pos] ?? null;
        }

        const parentRow = row.getParent();
        if (!parentRow) return null;

        const parentItem = this.resolveTreeItem(parentRow);
        if (!parentItem?.children) return null;

        const childItem = row.getItem();
        if (!childItem) return null;

        const childModel = parentRow.getChildren();
        if (childModel) {
            for (let j = 0; j < childModel.getNItems(); j++) {
                const obj = childModel.getObject(j);
                if (obj && obj.handle === childItem.handle) {
                    return parentItem.children[j] ?? null;
                }
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

    private applyOwnProps(oldProps: ListProps, newProps: ListProps): void {
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

    private rebuildSelectionModel(props: ListProps): void {
        this.selectionModel = this.createSelectionModel(props.selectionMode ?? Gtk.SelectionMode.SINGLE);
        this.assignModelToWidget();
        this.connectSelectionSignal();
    }

    private applySelection(ids: string[] | null): void {
        if (!this.selectionModel || this.isDropDown()) return;

        if (!ids || ids.length === 0) {
            if (this.selectionModel instanceof Gtk.SingleSelection) {
                this.selectionModel.setSelected(Gtk.INVALID_LIST_POSITION);
            } else if (this.selectionModel instanceof Gtk.MultiSelection) {
                this.selectionModel.unselectAll();
            }
            return;
        }

        const idSet = new Set(ids);
        const nItems = this.selectionModel.getNItems();

        if (this.selectionModel instanceof Gtk.SingleSelection) {
            for (let i = 0; i < nItems; i++) {
                const id = this.resolveItemIdAtPosition(i);
                if (id && idSet.has(id)) {
                    this.selectionModel.setSelected(i);
                    return;
                }
            }
        } else if (this.selectionModel instanceof Gtk.MultiSelection) {
            this.selectionModel.unselectAll();
            for (let i = 0; i < nItems; i++) {
                const id = this.resolveItemIdAtPosition(i);
                if (id && idSet.has(id)) {
                    this.selectionModel.selectItem(i, false);
                }
            }
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

    private connectSelectionSignal(): void {
        const { onSelectionChanged } = this.props;

        if (this.isDropDown()) {
            const handler = onSelectionChanged
                ? () => {
                      const position = this.getDropDownSelected();
                      const flatItems = this.collectFlatItems();
                      const item = flatItems[position];
                      if (item) {
                          (onSelectionChanged as (id: string) => void)(item.id);
                      }
                  }
                : undefined;

            this.signalStore.set(this, this.container as GObject.Object, "notify::selected", handler);
            return;
        }

        if (!this.selectionModel) return;

        const handler = onSelectionChanged
            ? () => {
                  const selection = this.selectionModel?.getSelection();
                  if (!selection) return;

                  const ids: string[] = [];
                  const nItems = this.selectionModel?.getNItems() ?? 0;

                  if (this.treeModel) {
                      for (let i = 0; i < nItems; i++) {
                          if (selection.contains(i)) {
                              const row = this.treeModel.getRow(i);
                              const item = row ? this.resolveTreeItem(row) : null;
                              if (item) ids.push(item.id);
                          }
                      }
                  } else {
                      const flatItems = this.collectFlatItems();
                      for (let i = 0; i < nItems; i++) {
                          if (selection.contains(i)) {
                              const item = flatItems[i];
                              if (item) ids.push(item.id);
                          }
                      }
                  }

                  (onSelectionChanged as (ids: string[]) => void)(ids);
              }
            : undefined;

        this.signalStore.set(this, this.selectionModel as GObject.Object, "selection-changed", handler, {
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
                  const cvSorter = columnView.getSorter() as Gtk.ColumnViewSorter | null;
                  if (!cvSorter) {
                      onSortChanged(null, Gtk.SortType.ASCENDING);
                      return;
                  }
                  const primaryColumn = cvSorter.getPrimarySortColumn();
                  const primaryOrder = cvSorter.getPrimarySortOrder();
                  const columnId = primaryColumn?.getId() ?? null;
                  onSortChanged(columnId, primaryOrder);
              }
            : undefined;

        this.signalStore.set(this, sorter as GObject.Object, "changed", handler, { blockable: false });
    }

    private applySortColumn(props: ListProps): void {
        if (!this.isColumnView()) return;

        const columnView = this.container as Gtk.ColumnView;
        const { sortColumn, sortOrder } = props;

        if (sortColumn === null || sortColumn === undefined) {
            columnView.sortByColumn(Gtk.SortType.ASCENDING, null);
            return;
        }

        const column = this.findColumnById(sortColumn);
        if (column) {
            columnView.sortByColumn(sortOrder ?? Gtk.SortType.ASCENDING, column);
        }
    }

    public findColumnById(id: string): Gtk.ColumnViewColumn | null {
        if (!this.isColumnView()) return null;
        const columnView = this.container as Gtk.ColumnView;
        const columns = columnView.getColumns();
        const nItems = columns.getNItems();

        for (let i = 0; i < nItems; i++) {
            const obj = columns.getObject(i) as Gtk.ColumnViewColumn | null;
            if (obj && obj.getId() === id) {
                return obj;
            }
        }
        return null;
    }

    private scheduleSync(): void {
        if (this.syncScheduled) return;
        this.syncScheduled = true;

        queueMicrotask(() => {
            this.syncScheduled = false;
            if (this.disposed) return;
            this.syncModel();
        });
    }

    public scheduleBoundItemsUpdate(): void {
        if (this.boundItemsUpdateScheduled) return;
        this.boundItemsUpdateScheduled = true;

        queueMicrotask(() => {
            this.boundItemsUpdateScheduled = false;
            if (this.disposed) return;
            this.rebuildBoundItems();
        });
    }

    private collectColumnViewBoundItems(flatItems: ListItem[]): BoundItem[] {
        const items: BoundItem[] = [];
        for (const child of this.children) {
            if (child instanceof ColumnViewColumnNode) {
                items.push(...child.collectBoundItems(flatItems));
            }
        }
        return items;
    }

    private collectStandardBoundItems(
        flatItems: ListItem[],
        renderItem: ListProps["renderItem"],
        renderListItem: ListProps["renderListItem"],
    ): BoundItem[] {
        const newBoundItems: BoundItem[] = [];
        const renderFn = renderItem ?? (this.isDropDown() ? (item: unknown) => String(item ?? "") : null);

        if (renderFn) {
            this.collectContainerBoundItems(
                this.containers,
                this.containerKeys,
                flatItems,
                renderFn,
                newBoundItems,
            );
        }

        if (renderListItem && this.isDropDown()) {
            this.collectContainerBoundItems(
                this.listContainers,
                this.listContainerKeys,
                flatItems,
                renderListItem,
                newBoundItems,
            );
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

        const flatItems = this.collectFlatItems();
        const newBoundItems = this.isColumnView()
            ? this.collectColumnViewBoundItems(flatItems)
            : this.collectStandardBoundItems(flatItems, renderItem, renderListItem);

        __boundItemsRef.current = newBoundItems;

        if (__headerBoundItemsRef && renderHeader && this.sectionStore !== null) {
            __headerBoundItemsRef.current = this.collectAllHeaderBoundItems(renderHeader);
        }

        __rerender();
    }

    private collectContainerBoundItems(
        containers: Map<Container, number>,
        containerKeys: Map<Container, string>,
        flatItems: ListItem[],
        renderFn: (item: unknown, row?: Gtk.TreeListRow | null) => ReactNode,
        out: BoundItem[],
    ): void {
        const isTree = this.treeModel !== null;

        for (const [container, position] of containers) {
            if (position === UNBOUND_POSITION) continue;

            const key = containerKeys.get(container);
            if (!key) continue;

            if (isTree) {
                const expander = container as Gtk.TreeExpander;
                const row = expander.getListRow() ?? null;
                if (!row) continue;
                const item = this.resolveTreeItem(row);
                if (!item) continue;
                const content = renderFn(item.value, row);
                out.push([content, container, key]);
            } else {
                const item = flatItems[position];
                if (!item) continue;
                const content = renderFn(item.value);
                out.push([content, container, key]);
            }
        }
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

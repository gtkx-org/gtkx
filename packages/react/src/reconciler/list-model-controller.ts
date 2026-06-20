import * as Gio from "@gtkx/gi/gio";
import type * as GObject from "@gtkx/gi/gobject";
import * as Gtk from "@gtkx/gi/gtk";
import type { ListItem } from "../utils/element-props.js";
import { indexOfInListModel, listModelItems } from "./list-model-iteration.js";

export interface ListModelHost {
    getItems(): ListItem[];
    getAutoexpand(): boolean;
    isDropDown(): boolean;
    assignBaseModelToSelection(model: Gio.ListModel): void;
    assignModelToWidget(): void;
    scheduleBoundItemsUpdate(): void;
}

type TreeResolveContext = {
    rootItems: ListItem[];
    rootIndex: Map<GObject.Object, number>;
};

function resizeStringList(model: Gtk.StringList, newSize: number): void {
    const oldSize = model.getNItems();
    if (newSize > oldSize) {
        model.splice(oldSize, 0, new Array(newSize - oldSize).fill(""));
    } else if (newSize < oldSize) {
        model.splice(newSize, oldSize - newSize, []);
    }
}

export class ListModelController {
    public model: Gtk.StringList | null = null;
    public treeModel: Gtk.TreeListModel | null = null;
    public flattenModel: Gtk.FlattenListModel | null = null;
    private sectionStore: Gio.ListStore | null = null;
    private sectionModels: Gtk.StringList[] = [];
    private treeChildModels = new Map<string, Gtk.StringList>();
    private rootItemIds: string[] = [];
    private modeCacheItems: ListItem[] | null = null;
    private modeCacheValue: "sections" | "tree" | "flat" = "flat";
    private flatItemsCacheKey: ListItem[] | null = null;
    private flatItemsCache: ListItem[] | null = null;
    private host: ListModelHost;

    constructor(host: ListModelHost) {
        this.host = host;
    }

    public hasSectionStore(): boolean {
        return this.sectionStore !== null;
    }

    public detach(): void {
        this.rootItemIds = [];
    }

    public setupModel(): void {
        this.model = new Gtk.StringList();
    }

    public getBaseModel(): Gio.ListModel {
        if (this.treeModel) return this.treeModel;
        if (this.flattenModel) return this.flattenModel;
        return this.model as Gtk.StringList;
    }

    public setAutoexpand(value: boolean): void {
        this.treeModel?.setAutoexpand(value);
    }

    private getItems(): ListItem[] {
        return this.host.getItems();
    }

    public collectFlatItems(): ListItem[] {
        const items = this.getItems();
        if (this.flatItemsCacheKey === items && this.flatItemsCache) return this.flatItemsCache;

        let flat: ListItem[];
        if (this.detectMode() === "flat") {
            flat = items;
        } else {
            flat = [];
            for (const item of items) {
                if (item.section && item.children) {
                    for (const child of item.children) {
                        flat.push(child);
                    }
                } else {
                    flat.push(item);
                }
            }
        }

        this.flatItemsCacheKey = items;
        this.flatItemsCache = flat;
        return flat;
    }

    public collectSections(): ListItem[] {
        const items = this.getItems();
        const sections: ListItem[] = [];
        for (const item of items) {
            if (item.section) {
                sections.push(item);
            }
        }
        return sections;
    }

    public collectRootItems(): ListItem[] {
        return this.getItems().filter((item) => !item.section);
    }

    public detectMode(): "sections" | "tree" | "flat" {
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

    public hasSections(): boolean {
        return this.getItems().some((item) => item.section);
    }

    public isTreeMode(): boolean {
        const items = this.getItems();
        for (const item of items) {
            if (!item.section && item.children && item.children.length > 0) return true;
        }
        return false;
    }

    public syncModel(): void {
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

        this.host.scheduleBoundItemsUpdate();
    }

    private initializeTreeModel(rootItems: ListItem[], newSize: number): void {
        if (!this.model) return;
        this.treeChildModels.clear();
        this.model.splice(0, this.model.getNItems(), new Array(newSize).fill(""));
        this.rootItemIds = rootItems.map((item) => item.id);

        this.treeModel = Gtk.TreeListModel.new(this.model, false, this.host.getAutoexpand(), (_item: GObject.Object) =>
            this.createChildModel(_item),
        );

        this.host.assignBaseModelToSelection(this.treeModel);
        this.host.scheduleBoundItemsUpdate();
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
        this.host.scheduleBoundItemsUpdate();
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
        return indexOfInListModel(this.model, item);
    }

    public positionOf(item: GObject.Object): number | null {
        const model = this.hasSections() ? this.flattenModel : this.model;
        if (!model) return null;
        return indexOfInListModel(model, item);
    }

    private syncSectionModel(): void {
        if (!this.model) return;

        const sections = this.collectSections();

        if (!this.sectionStore) {
            this.sectionStore = Gio.ListStore.new(Gtk.StringList.prototype.__gtype__);
            this.flattenModel = new Gtk.FlattenListModel({ model: this.sectionStore });

            this.host.assignBaseModelToSelection(this.flattenModel);

            if (this.host.isDropDown()) {
                this.host.assignModelToWidget();
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

        this.host.scheduleBoundItemsUpdate();
    }

    public resolveTreeItem(row: Gtk.TreeListRow, ctx?: TreeResolveContext): ListItem | null {
        if (row.getDepth() === 0) {
            return this.resolveRootTreeItem(row, ctx);
        }
        return this.resolveChildTreeItem(row, ctx);
    }

    private resolveRootTreeItem(row: Gtk.TreeListRow, ctx?: TreeResolveContext): ListItem | null {
        const rootItem = row.getItem();
        if (!rootItem) return null;
        if (ctx) {
            const pos = ctx.rootIndex.get(rootItem);
            return pos === undefined ? null : (ctx.rootItems[pos] ?? null);
        }
        const pos = this.findStringObjectPosition(rootItem);
        if (pos === null) return null;
        return this.collectRootItems()[pos] ?? null;
    }

    private resolveChildTreeItem(row: Gtk.TreeListRow, ctx?: TreeResolveContext): ListItem | null {
        const parentRow = row.getParent();
        if (!parentRow) return null;

        const parentItem = this.resolveTreeItem(parentRow, ctx);
        if (!parentItem?.children) return null;

        const childItem = row.getItem();
        if (!childItem) return null;

        return this.findChildItemInRow(parentRow, parentItem.children, childItem);
    }

    private findChildItemInRow(
        parentRow: Gtk.TreeListRow,
        siblings: ListItem[],
        childItem: GObject.Object,
    ): ListItem | null {
        const childModel = parentRow.getChildren();
        if (!childModel) return null;
        const index = indexOfInListModel(childModel, childItem);
        return index !== null ? (siblings[index] ?? null) : null;
    }

    public resolveIdsAtPositions(count: number): (string | null)[] {
        const ids: (string | null)[] = new Array(count);

        if (!this.treeModel) {
            const flat = this.collectFlatItems();
            for (let i = 0; i < count; i++) {
                ids[i] = flat[i]?.id ?? null;
            }
            return ids;
        }

        const ctx = this.buildTreeResolveContext();
        for (let i = 0; i < count; i++) {
            const row = this.treeModel.getRow(i);
            ids[i] = row ? (this.resolveTreeItem(row, ctx)?.id ?? null) : null;
        }
        return ids;
    }

    private buildTreeResolveContext(): TreeResolveContext {
        const rootItems = this.collectRootItems();
        const rootIndex = new Map<GObject.Object, number>();
        if (this.model) {
            let position = 0;
            for (const obj of listModelItems(this.model)) rootIndex.set(obj, position++);
        }
        return { rootItems, rootIndex };
    }
}

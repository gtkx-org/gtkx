import * as Gtk from "@gtkx/ffi/gtk";

type TreeItemUpdatedCallback = (id: string) => void;

export type TreeItemData<T = unknown> = {
    value: T;
    indentForDepth?: boolean;
    indentForIcon?: boolean;
    hideExpander?: boolean;
};

export class TreeStore {
    private rootIds: string[] = [];
    private rootIdToIndex = new Map<string, number>();
    private children = new Map<string, string[]>();
    private childIdToIndex = new Map<string, Map<string, number>>();
    private rootModel = new Gtk.StringList();
    private childModels = new Map<string, Gtk.StringList>();
    private items = new Map<string, TreeItemData>();
    private onItemUpdated: TreeItemUpdatedCallback | null = null;
    private pendingBatch: string[] | null = null;
    private pendingRemovals: Set<string> | null = null;
    private flushScheduled = false;

    public setOnItemUpdated(callback: TreeItemUpdatedCallback | null): void {
        this.onItemUpdated = callback;
    }

    public beginBatch(): void {
        this.pendingBatch = [];
    }

    public flushBatch(): void {
        const batch = this.pendingBatch;
        this.pendingBatch = null;
        if (batch && batch.length > 0) {
            this.rootModel.splice(0, 0, batch);
        }
    }

    public updateItem(id: string, item: TreeItemData): void {
        if (this.items.has(id)) {
            this.items.set(id, item);
            this.onItemUpdated?.(id);
        } else {
            this.addItem(id, item);
        }
    }

    public addItem(id: string, data: TreeItemData, parentId?: string): void {
        if (parentId === undefined) this.flushRemovals();
        this.items.set(id, data);

        if (parentId === undefined) {
            const existingIndex = this.rootIdToIndex.get(id);
            if (existingIndex !== undefined) {
                this.rootModel.remove(existingIndex);
                this.rootIds.splice(existingIndex, 1);
                this.rebuildRootIndices(existingIndex);
            }

            this.rootIdToIndex.set(id, this.rootIds.length);
            this.rootIds.push(id);

            if (this.pendingBatch) {
                this.pendingBatch.push(id);
            } else {
                this.rootModel.append(id);
            }
        } else {
            let siblings = this.children.get(parentId);
            let indexMap = this.childIdToIndex.get(parentId);
            if (!siblings) {
                siblings = [];
                this.children.set(parentId, siblings);
            }
            if (!indexMap) {
                indexMap = new Map();
                this.childIdToIndex.set(parentId, indexMap);
            }

            const existingIndex = indexMap.get(id);
            if (existingIndex !== undefined) {
                const model = this.childModels.get(parentId);
                if (model) {
                    model.remove(existingIndex);
                }
                siblings.splice(existingIndex, 1);
                this.rebuildChildIndices(siblings, indexMap, existingIndex);
            }

            indexMap.set(id, siblings.length);
            siblings.push(id);

            let model = this.childModels.get(parentId);
            if (!model) {
                model = new Gtk.StringList();
                this.childModels.set(parentId, model);
            }
            model.append(id);
        }
    }

    public removeItem(id: string, parentId?: string): void {
        this.items.delete(id);
        this.children.delete(id);
        this.childIdToIndex.delete(id);
        this.childModels.delete(id);

        if (parentId !== undefined) {
            const siblings = this.children.get(parentId);
            const indexMap = this.childIdToIndex.get(parentId);
            if (siblings && indexMap) {
                const index = indexMap.get(id);
                if (index !== undefined) {
                    siblings.splice(index, 1);
                    indexMap.delete(id);
                    this.rebuildChildIndices(siblings, indexMap, index);
                    const model = this.childModels.get(parentId);
                    if (model) {
                        model.remove(index);
                    }
                }
                if (siblings.length === 0) {
                    this.children.delete(parentId);
                    this.childIdToIndex.delete(parentId);
                }
            }
            return;
        }

        if (!this.rootIdToIndex.has(id)) return;

        if (!this.pendingRemovals) {
            this.pendingRemovals = new Set();
            if (!this.flushScheduled) {
                this.flushScheduled = true;
                queueMicrotask(() => this.flushRemovals());
            }
        }
        this.pendingRemovals.add(id);
    }

    public flushRemovals(): void {
        this.flushScheduled = false;
        const removals = this.pendingRemovals;
        if (!removals || removals.size === 0) {
            this.pendingRemovals = null;
            return;
        }
        this.pendingRemovals = null;

        const indices: number[] = [];
        for (const id of removals) {
            const index = this.rootIdToIndex.get(id);
            if (index !== undefined) {
                indices.push(index);
                this.rootIdToIndex.delete(id);
            }
        }

        if (indices.length === 0) return;

        indices.sort((a, b) => a - b);

        let i = indices.length - 1;
        while (i >= 0) {
            let rangeStart = indices[i] ?? 0;
            const rangeEnd = rangeStart;

            while (i > 0) {
                const prev = indices[i - 1];
                if (prev !== rangeStart - 1) break;
                i--;
                rangeStart = prev ?? 0;
            }

            const count = rangeEnd - rangeStart + 1;
            this.rootModel.splice(rangeStart, count);
            this.rootIds.splice(rangeStart, count);

            i--;
        }

        this.rebuildRootIndices(0);
    }

    public insertItemBefore(id: string, beforeId: string, data: TreeItemData, parentId?: string): void {
        if (parentId === undefined) this.flushRemovals();
        this.items.set(id, data);

        if (parentId === undefined) {
            const existingIndex = this.rootIdToIndex.get(id);
            if (existingIndex !== undefined) {
                this.rootModel.remove(existingIndex);
                this.rootIds.splice(existingIndex, 1);
                this.rootIdToIndex.delete(id);
                this.rebuildRootIndices(existingIndex);
            }

            const beforeIndex = this.rootIdToIndex.get(beforeId);
            if (beforeIndex === undefined) {
                this.rootIdToIndex.set(id, this.rootIds.length);
                this.rootIds.push(id);
                this.rootModel.append(id);
            } else {
                this.rootIds.splice(beforeIndex, 0, id);
                this.rebuildRootIndices(beforeIndex);
                this.rootModel.splice(beforeIndex, 0, [id]);
            }
        } else {
            let siblings = this.children.get(parentId);
            let indexMap = this.childIdToIndex.get(parentId);
            if (!siblings) {
                siblings = [];
                this.children.set(parentId, siblings);
            }
            if (!indexMap) {
                indexMap = new Map();
                this.childIdToIndex.set(parentId, indexMap);
            }

            let model = this.childModels.get(parentId);
            if (!model) {
                model = new Gtk.StringList();
                this.childModels.set(parentId, model);
            }

            const existingIndex = indexMap.get(id);
            if (existingIndex !== undefined) {
                model.remove(existingIndex);
                siblings.splice(existingIndex, 1);
                indexMap.delete(id);
                this.rebuildChildIndices(siblings, indexMap, existingIndex);
            }

            const beforeIndex = indexMap.get(beforeId);
            if (beforeIndex === undefined) {
                indexMap.set(id, siblings.length);
                siblings.push(id);
                model.append(id);
            } else {
                siblings.splice(beforeIndex, 0, id);
                this.rebuildChildIndices(siblings, indexMap, beforeIndex);
                model.splice(beforeIndex, 0, [id]);
            }
        }
    }

    public getItem(id: string): TreeItemData | undefined {
        return this.items.get(id);
    }

    public getRootModel(): Gtk.StringList {
        return this.rootModel;
    }

    public getChildrenModel(parentId: string): Gtk.StringList | null {
        const childIds = this.children.get(parentId);
        if (!childIds || childIds.length === 0) {
            return null;
        }

        let model = this.childModels.get(parentId);
        if (!model) {
            model = new Gtk.StringList(childIds);
            this.childModels.set(parentId, model);
        }

        return model;
    }

    public hasChildren(parentId: string): boolean {
        const childIds = this.children.get(parentId);
        return childIds !== undefined && childIds.length > 0;
    }

    private rebuildRootIndices(fromIndex: number): void {
        for (let i = fromIndex; i < this.rootIds.length; i++) {
            this.rootIdToIndex.set(this.rootIds[i] as string, i);
        }
    }

    private rebuildChildIndices(siblings: string[], indexMap: Map<string, number>, fromIndex: number): void {
        for (let i = fromIndex; i < siblings.length; i++) {
            indexMap.set(siblings[i] as string, i);
        }
    }
}

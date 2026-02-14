import { SectionedListStore } from "./sectioned-list-store.js";

type ItemUpdatedCallback = (id: string) => void;

export class ListStore extends SectionedListStore {
    private items = new Map<string, unknown>();
    private onItemUpdated: ItemUpdatedCallback | null = null;

    public setOnItemUpdated(callback: ItemUpdatedCallback | null): void {
        this.onItemUpdated = callback;
    }

    protected override getInitialPendingBatch(): string[] | null {
        return null;
    }

    protected override getModelString(itemId: string, _item: unknown): string {
        return itemId;
    }

    protected override onItemAdded(itemId: string, item: unknown): void {
        this.items.set(itemId, item);
    }

    protected override onItemRemoved(itemId: string): void {
        this.items.delete(itemId);
    }

    public addItem(id: string, item: unknown): void {
        this.items.set(id, item);

        const existingIndex = this.idToIndex.get(id);
        if (existingIndex !== undefined) {
            this.model.remove(existingIndex);
            this.ids.splice(existingIndex, 1);
            this.rebuildIndices(existingIndex);
        }

        this.idToIndex.set(id, this.ids.length);
        this.ids.push(id);

        if (this.pendingBatch) {
            this.pendingBatch.push(id);
        } else {
            this.model.append(id);
        }
    }

    public insertItemBefore(id: string, beforeId: string, item: unknown): void {
        this.items.set(id, item);

        const existingIndex = this.idToIndex.get(id);
        if (existingIndex !== undefined) {
            this.model.remove(existingIndex);
            this.ids.splice(existingIndex, 1);
            this.idToIndex.delete(id);
            this.rebuildIndices(existingIndex);
        }

        const beforeIndex = this.idToIndex.get(beforeId);
        if (beforeIndex === undefined) {
            this.idToIndex.set(id, this.ids.length);
            this.ids.push(id);
            this.model.append(id);
        } else {
            this.ids.splice(beforeIndex, 0, id);
            this.rebuildIndices(beforeIndex);
            this.model.splice(beforeIndex, 0, [id]);
        }
    }

    public updateItem(id: string, item: unknown): void {
        if (this.items.has(id)) {
            this.items.set(id, item);
            this.onItemUpdated?.(id);
        } else {
            this.addItem(id, item);
        }
    }

    public getItem(id: string): unknown {
        return this.items.get(id);
    }

    public getHeaderValue(itemId: string): unknown {
        const sectionId = this.itemToSection.get(itemId);
        if (sectionId) {
            return this.headerValues.get(sectionId);
        }
        return undefined;
    }

    public getHeaderValueById(sectionId: string): unknown {
        return this.headerValues.get(sectionId);
    }

    public getStringList(): import("@gtkx/ffi/gtk").StringList {
        return this.model;
    }

    public getNItems(): number {
        return this.ids.length;
    }
}

import * as Gtk from "@gtkx/ffi/gtk";
import { BaseStore } from "./base-store.js";

export type ItemUpdatedCallback = (id: string) => void;

export class ListStore extends BaseStore<unknown> {
    private model: Gtk.StringList = new Gtk.StringList();
    private newSortedIds: string[] = [];
    private newIdSet: Set<string> = new Set();
    private sortedIds: string[] = [];
    private onItemUpdated: ItemUpdatedCallback | null = null;

    public setOnItemUpdated(callback: ItemUpdatedCallback | null): void {
        this.onItemUpdated = callback;
    }

    public addItem(id: string, item: unknown): void {
        this.items.set(id, item);

        if (this.newIdSet.has(id)) {
            const existingIndex = this.newSortedIds.indexOf(id);
            this.newSortedIds.splice(existingIndex, 1);
        }

        this.newSortedIds.push(id);
        this.newIdSet.add(id);
        this.scheduleSync();
    }

    public removeItem(id: string): void {
        if (!this.newIdSet.has(id)) return;

        const index = this.newSortedIds.indexOf(id);
        this.newSortedIds.splice(index, 1);
        this.newIdSet.delete(id);
        this.items.delete(id);
        this.scheduleSync();
    }

    public insertItemBefore(id: string, beforeId: string, item: unknown): void {
        this.items.set(id, item);

        if (this.newIdSet.has(id)) {
            const existingIndex = this.newSortedIds.indexOf(id);
            this.newSortedIds.splice(existingIndex, 1);
        }

        const beforeIndex = this.newSortedIds.indexOf(beforeId);

        if (beforeIndex === -1) {
            this.newSortedIds.push(id);
        } else {
            this.newSortedIds.splice(beforeIndex, 0, id);
        }

        this.newIdSet.add(id);
        this.scheduleSync();
    }

    public override updateItem(id: string, item: unknown): void {
        if (this.items.has(id)) {
            this.items.set(id, item);
            this.onItemUpdated?.(id);
        } else {
            this.addItem(id, item);
        }
    }

    public getModel(): Gtk.StringList {
        return this.model;
    }

    protected override sync(): void {
        const newOrder = this.newSortedIds;
        const oldLength = this.sortedIds.length;
        this.model.splice(0, oldLength, newOrder.length > 0 ? newOrder : undefined);
        this.sortedIds = [...newOrder];
    }
}

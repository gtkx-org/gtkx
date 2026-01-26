import * as Gtk from "@gtkx/ffi/gtk";

export type ItemUpdatedCallback = (id: string) => void;

export class ListStore {
    private model: Gtk.StringList = new Gtk.StringList();
    private ids: string[] = [];
    private items: Map<string, unknown> = new Map();
    private onItemUpdated: ItemUpdatedCallback | null = null;

    public setOnItemUpdated(callback: ItemUpdatedCallback | null): void {
        this.onItemUpdated = callback;
    }

    public addItem(id: string, item: unknown): void {
        this.items.set(id, item);

        const existingIndex = this.ids.indexOf(id);
        if (existingIndex >= 0) {
            this.model.remove(existingIndex);
            this.ids.splice(existingIndex, 1);
        }

        this.ids.push(id);
        this.model.append(id);
    }

    public removeItem(id: string): void {
        const index = this.ids.indexOf(id);
        if (index < 0) return;

        this.model.remove(index);
        this.ids.splice(index, 1);
        this.items.delete(id);
    }

    public insertItemBefore(id: string, beforeId: string, item: unknown): void {
        this.items.set(id, item);

        const existingIndex = this.ids.indexOf(id);
        if (existingIndex >= 0) {
            this.model.remove(existingIndex);
            this.ids.splice(existingIndex, 1);
        }

        const beforeIndex = this.ids.indexOf(beforeId);
        if (beforeIndex < 0) {
            this.ids.push(id);
            this.model.append(id);
        } else {
            this.ids.splice(beforeIndex, 0, id);
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

    public getModel(): Gtk.StringList {
        return this.model;
    }
}

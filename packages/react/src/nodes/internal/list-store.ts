import * as Gtk from "@gtkx/ffi/gtk";

export class ListStore {
    private items: Map<string, unknown> = new Map();
    private model: Gtk.StringList = new Gtk.StringList();

    public addItem(id: string, item: unknown): void {
        this.items.set(id, item);
        this.model.append(id);
    }

    public removeItem(id: string): void {
        this.items.delete(id);
        this.model.remove(this.model.find(id));
    }

    public insertItemBefore(id: string, beforeId: string, item: unknown): void {
        const beforeIndex = this.model.find(beforeId);
        this.items.set(id, item);
        this.model.splice(beforeIndex, 0, [id]);
    }

    public updateItem(id: string, item: unknown): void {
        const index = this.model.find(id);
        this.removeItem(id);
        this.items.set(id, item);
        this.model.splice(index, 0, [id]);
    }

    public getItem(id: string) {
        return this.items.get(id);
    }

    public getModel(): Gtk.StringList {
        return this.model;
    }
}

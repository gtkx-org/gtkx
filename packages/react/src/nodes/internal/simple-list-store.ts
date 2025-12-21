import * as Gtk from "@gtkx/ffi/gtk";

export class SimpleListStore {
    private ids: string[] = [];
    private model: Gtk.StringList = new Gtk.StringList();

    public addItem(id: string, label: string): void {
        this.ids.push(id);
        this.model.append(label);
    }

    public removeItem(id: string): void {
        const index = this.ids.indexOf(id);
        this.model.remove(index);
        this.ids.splice(index, 1);
    }

    public insertItemBefore(id: string, beforeId: string, label: string): void {
        const beforeIndex = this.ids.indexOf(beforeId);
        this.ids.splice(beforeIndex, 0, id);
        this.model.splice(beforeIndex, 0, [label]);
    }

    public updateItem(id: string, label: string): void {
        const index = this.ids.indexOf(id);
        this.removeItem(id);
        this.ids.splice(index, 0, id);
        this.model.splice(index, 0, [label]);
    }

    public getItem(id: string) {
        return this.model.getString(this.ids.indexOf(id));
    }

    public getModel(): Gtk.StringList {
        return this.model;
    }
}

import { batch } from "@gtkx/ffi";
import * as Gtk from "@gtkx/ffi/gtk";

export class SimpleListStore {
    private ids: string[] = [];
    private model: Gtk.StringList = new Gtk.StringList();

    public addItem(id: string, label: string): void {
        this.ids.push(id);
        this.model.append(label);
    }

    public appendItem(id: string, label: string): void {
        const existingIndex = this.ids.indexOf(id);

        batch(() => {
            if (existingIndex >= 0) {
                this.model.remove(existingIndex);
                this.ids.splice(existingIndex, 1);
            }

            this.ids.push(id);
            this.model.append(label);
        });
    }

    public removeItem(id: string): void {
        const index = this.ids.indexOf(id);
        if (index < 0) {
            return;
        }
        this.model.remove(index);
        this.ids.splice(index, 1);
    }

    public insertItemBefore(id: string, beforeId: string, label: string): void {
        const beforeIndex = this.ids.indexOf(beforeId);
        if (beforeIndex < 0) {
            this.addItem(id, label);
        } else {
            this.ids.splice(beforeIndex, 0, id);
            this.model.splice(beforeIndex, 0, [label]);
        }
    }

    public updateItem(id: string, label: string): void {
        const index = this.ids.indexOf(id);
        if (index < 0) {
            this.addItem(id, label);
            return;
        }
        this.model.splice(index, 1, [label]);
    }

    public getItem(id: string) {
        return this.model.getString(this.ids.indexOf(id));
    }

    public getIdAtIndex(index: number): string | null {
        return this.ids[index] ?? null;
    }

    public getIndexById(id: string): number | null {
        const index = this.ids.indexOf(id);
        return index >= 0 ? index : null;
    }

    public getModel(): Gtk.StringList {
        return this.model;
    }
}

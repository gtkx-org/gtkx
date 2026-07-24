import type * as GObject from "@gtkx/gi/gobject";
import type * as Gtk from "@gtkx/gi/gtk";

export type CellKind = "item" | "header";

export type CellRecord = {
    key: number;
    kind: CellKind;
    cell: GObject.Object;
    target: GObject.Object;
    holder: GObject.Object;
    row: Gtk.TreeListRow | null;
    slot: string | null;
    position: () => number;
};

export class CellTracker {
    private records = new Map<GObject.Object, CellRecord>();
    private serial = 0;
    private notify: () => void = () => {};

    setNotify(notify: () => void): void {
        this.notify = notify;
    }

    add(record: Omit<CellRecord, "key">): void {
        this.serial += 1;
        this.records.set(record.cell, { ...record, key: this.serial });
        this.notify();
    }

    remove(cell: GObject.Object): void {
        if (this.records.delete(cell)) this.notify();
    }

    refresh(): void {
        this.notify();
    }

    values(): CellRecord[] {
        return [...this.records.values()];
    }
}

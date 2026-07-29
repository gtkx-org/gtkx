import * as Gtk from "@gtkx/gi/gtk";

const POLYFILLED_METHODS = ["getId", "setId"] as const;
const columnIds: WeakMap<object, string> = new WeakMap();

class ColumnViewColumnFallback extends Gtk.ColumnViewColumn {
    override getId(): string | null {
        return columnIds.get(this) ?? null;
    }

    override setId(id: string | null): void {
        if (id === null) {
            columnIds.delete(this);

            return;
        }

        columnIds.set(this, id);
    }
}

if (process.env.GTKX_GIR_PATH) {
    for (const method of POLYFILLED_METHODS) {
        const fallback = Object.getOwnPropertyDescriptor(ColumnViewColumnFallback.prototype, method);

        if (fallback) {
            Object.defineProperty(Gtk.ColumnViewColumn.prototype, method, fallback);
        }
    }
}

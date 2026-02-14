import * as Gtk from "@gtkx/ffi/gtk";

type StoreWithIdLookup = {
    getIdAtIndex(index: number): string | null;
};

type StoreWithIndexLookup = {
    getIndexById(id: string): number | null;
    getNItems(): number;
};

export function getSelectionFromStore(selection: Gtk.Bitset, store: StoreWithIdLookup): string[] {
    const size = selection.getSize();
    const ids: string[] = [];
    for (let i = 0; i < size; i++) {
        const index = selection.getNth(i);
        const id = store.getIdAtIndex(index);
        if (id !== null) {
            ids.push(id);
        }
    }
    return ids;
}

export function resolveSelectionIndices(ids: string[], store: StoreWithIndexLookup): Gtk.Bitset {
    const nItems = store.getNItems();
    const selected = new Gtk.Bitset();
    for (const id of ids) {
        const index = store.getIndexById(id);
        if (index !== null && index < nItems) {
            selected.add(index);
        }
    }
    return selected;
}

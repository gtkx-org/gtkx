import type * as GObject from "@gtkx/gi/gobject";

export interface ListModelLike {
    getNItems(): number;
    getItem(position: number): GObject.Object | null;
}

export function* listModelItems(model: ListModelLike): Generator<GObject.Object> {
    const count = model.getNItems();
    for (let position = 0; position < count; position++) {
        const item = model.getItem(position);
        if (item !== null) yield item;
    }
}

export const indexOfInListModel = (model: ListModelLike, target: GObject.Object): number | null => {
    const count = model.getNItems();
    for (let position = 0; position < count; position++) {
        if (model.getItem(position) === target) return position;
    }
    return null;
};

export const findInListModel = <T extends GObject.Object>(
    model: ListModelLike,
    predicate: (item: GObject.Object) => item is T,
): T | null => {
    for (const item of listModelItems(model)) {
        if (predicate(item)) return item;
    }
    return null;
};

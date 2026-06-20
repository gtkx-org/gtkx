import type * as GObject from "@gtkx/gi/gobject";

/** The read surface of a `Gio.ListModel` the iteration helpers consume. */
export interface ListModelLike {
    getNItems(): number;
    getItem(position: number): GObject.Object | null;
}

/**
 * Yields each item a list model holds in position order, skipping the `null`
 * holes a sparse model may report. One pass over the model is all every scan
 * needs, so callers iterate this instead of re-spelling the index loop.
 *
 * @param model - The list model to walk.
 */
export function* listModelItems(model: ListModelLike): Generator<GObject.Object> {
    const count = model.getNItems();
    for (let position = 0; position < count; position++) {
        const item = model.getItem(position);
        if (item !== null) yield item;
    }
}

/**
 * The position of `target` in `model` by identity, or `null` when it is absent.
 *
 * @param model - The list model to search.
 * @param target - The object whose position to find.
 */
export const indexOfInListModel = (model: ListModelLike, target: GObject.Object): number | null => {
    const count = model.getNItems();
    for (let position = 0; position < count; position++) {
        if (model.getItem(position) === target) return position;
    }
    return null;
};

/**
 * The first item in `model` that `predicate` admits, or `null` when none does.
 * The predicate doubles as a type guard so the caller narrows without a cast.
 *
 * @param model - The list model to search.
 * @param predicate - Whether an item is the one to return.
 */
export const findInListModel = <T extends GObject.Object>(
    model: ListModelLike,
    predicate: (item: GObject.Object) => item is T,
): T | null => {
    for (const item of listModelItems(model)) {
        if (predicate(item)) return item;
    }
    return null;
};

/// <reference types="@gtkx/config/env" />

import { ORDERED_INSERT } from "virtual:gtkx-config";
import type { OrderedInsertSpec } from "@gtkx/config";
import * as GObject from "@gtkx/gi/gobject";
import { callMethod } from "@gtkx/utils";
import { findInheritedRow } from "../utils/gtype.js";
import type { Node } from "./state.js";

type ItemCollection = { getNItems(): number; getItem(position: number): unknown };

const orderedInsertCache = new Map<GObject.Type, OrderedInsertSpec | null>();

export const resolveOrderedInsert = (parent: Node): OrderedInsertSpec | null => {
    if (!(parent instanceof GObject.Object)) return null;
    const gtype = parent.__gtype__;
    const cached = orderedInsertCache.get(gtype);
    if (cached !== undefined) return cached;
    const resolved = findInheritedRow(gtype, ORDERED_INSERT) ?? null;
    orderedInsertCache.set(gtype, resolved);
    return resolved;
};

const collectionOf = (parent: GObject.Object, getter: string): ItemCollection | null => {
    const fn = Reflect.get(parent, getter);
    if (typeof fn !== "function") return null;
    const collection = Reflect.apply(fn, parent, []);
    if (
        !collection ||
        typeof collection !== "object" ||
        typeof Reflect.get(collection, "getNItems") !== "function" ||
        typeof Reflect.get(collection, "getItem") !== "function"
    ) {
        return null;
    }
    return collection as ItemCollection;
};

const indexOf = (collection: ItemCollection, item: GObject.Object): number => {
    const nItems = collection.getNItems();
    for (let i = 0; i < nItems; i++) {
        if (collection.getItem(i) === item) return i;
    }
    return -1;
};

const insertPosition = (collection: ItemCollection, anchor: GObject.Object | null | undefined): number => {
    if (anchor != null) {
        const anchorIndex = indexOf(collection, anchor);
        if (anchorIndex >= 0) return anchorIndex;
    }
    return collection.getNItems();
};

const isPlacedBefore = (
    collection: ItemCollection,
    item: GObject.Object,
    anchor: GObject.Object | null | undefined,
): boolean => {
    const index = indexOf(collection, item);
    if (index < 0) return false;
    if (anchor != null) return indexOf(collection, anchor) === index + 1;
    return index === collection.getNItems() - 1;
};

type OrderedInsertState = { parent: GObject.Object };

const orderedInsertState = new WeakMap<Node, OrderedInsertState>();

const itemsFrom = (collection: ItemCollection, fromIndex: number): GObject.Object[] => {
    const items: GObject.Object[] = [];
    const nItems = collection.getNItems();
    for (let i = fromIndex; i < nItems; i++) {
        const item = collection.getItem(i);
        if (item instanceof GObject.Object) items.push(item);
    }
    return items;
};

const rerealizeTrailing = (
    spec: OrderedInsertSpec,
    parent: GObject.Object,
    collection: ItemCollection,
    afterPosition: number,
): void => {
    for (const item of itemsFrom(collection, afterPosition + 1)) {
        const at = indexOf(collection, item);
        if (at < 0) continue;
        callMethod(parent, spec.detach, [item]);
        callMethod(parent, spec.attach, [at, item]);
    }
};

export const attachOrderedInsert = (
    spec: OrderedInsertSpec,
    child: Node,
    parent: Node,
    anchor: GObject.Object | null | undefined,
): void => {
    if (!(child instanceof GObject.Object) || !(parent instanceof GObject.Object)) return;
    const collection = collectionOf(parent, spec.collection);
    if (!collection) return;
    const state = orderedInsertState.get(child);
    const isMove = state?.parent === parent && indexOf(collection, child) >= 0;
    if (isMove) {
        if (isPlacedBefore(collection, child, anchor)) return;
        callMethod(parent, spec.detach, [child]);
    }
    const position = insertPosition(collection, anchor);
    callMethod(parent, spec.attach, [position, child]);
    orderedInsertState.set(child, { parent });
    if (!isMove && position < collection.getNItems() - 1) {
        rerealizeTrailing(spec, parent, collection, position);
    }
};

export const detachOrderedInsert = (spec: OrderedInsertSpec, child: Node, parent: Node): void => {
    if (!(child instanceof GObject.Object) || !(parent instanceof GObject.Object)) return;
    if (orderedInsertState.get(child)?.parent !== parent) return;
    callMethod(parent, spec.detach, [child]);
    orderedInsertState.delete(child);
};

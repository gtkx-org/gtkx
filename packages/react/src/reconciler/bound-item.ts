import type * as GObject from "@gtkx/gi/gobject";
import type { ReactNode } from "react";
import { type BoundContainerRegistry, UNBOUND_POSITION } from "./bound-container-registry.js";

export type BoundItem = [ReactNode, GObject.Object, string];

export type FlatBoundItemsQuery<C extends GObject.Object> = {
    registry: BoundContainerRegistry<C>;
    resolveItem: (position: number) => unknown;
    render: (value: unknown) => ReactNode;
    out: BoundItem[];
};

export const collectFlatBoundItems = <C extends GObject.Object>(query: FlatBoundItemsQuery<C>): void => {
    const { registry, resolveItem, render, out } = query;
    for (const { container, position, key } of registry.entries()) {
        if (position === UNBOUND_POSITION) continue;
        const value = resolveItem(position);
        if (value === undefined || value === null) continue;
        out.push([render(value), container, key]);
    }
};

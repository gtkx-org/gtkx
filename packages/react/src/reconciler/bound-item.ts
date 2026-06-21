import type * as GObject from "@gtkx/gi/gobject";
import type { ReactNode } from "react";
import { UNBOUND_POSITION } from "./list-factory.js";

export type BoundItem = [ReactNode, GObject.Object, string];

export type FlatBoundItemsQuery = {
    containers: Map<GObject.Object, number>;
    containerKeys: Map<GObject.Object, string>;
    resolveItem: (position: number) => unknown;
    render: (value: unknown) => ReactNode;
    out: BoundItem[];
};

export const collectFlatBoundItems = (query: FlatBoundItemsQuery): void => {
    const { containers, containerKeys, resolveItem, render, out } = query;
    for (const [container, position] of containers) {
        if (position === UNBOUND_POSITION) continue;
        const key = containerKeys.get(container);
        if (!key) continue;
        const value = resolveItem(position);
        if (value === undefined || value === null) continue;
        out.push([render(value), container, key]);
    }
};

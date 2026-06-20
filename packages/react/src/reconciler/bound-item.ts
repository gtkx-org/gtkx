import type * as GObject from "@gtkx/gi/gobject";
import type { ReactNode } from "react";
import { UNBOUND_POSITION } from "./list-factory.js";

export type BoundItem = [ReactNode, GObject.Object, string];

// biome-ignore lint/complexity/useMaxParams: shared flat collector; the maps, resolver, renderer, and accumulator are its variation points
export const collectFlatBoundItems = (
    containers: Map<GObject.Object, number>,
    containerKeys: Map<GObject.Object, string>,
    resolveItem: (position: number) => unknown,
    render: (value: unknown) => ReactNode,
    out: BoundItem[],
): void => {
    for (const [container, position] of containers) {
        if (position === UNBOUND_POSITION) continue;
        const key = containerKeys.get(container);
        if (!key) continue;
        const value = resolveItem(position);
        if (value === undefined || value === null) continue;
        out.push([render(value), container, key]);
    }
};

import type * as GObject from "@gtkx/gi/gobject";
import type { ReactNode } from "react";
import { UNBOUND_POSITION } from "./list-factory.js";

export type BoundItem = [ReactNode, GObject.Object, string];

/**
 * Collects the bound, flat-positioned cells of a container map into `out`.
 *
 * For each container holding a bound position, resolves the item at that
 * position, renders it, and appends the `[node, container, key]` triple. A
 * container that is still unbound, has no tracked key, or whose item resolves to
 * `null`/`undefined` is skipped. Shared by the flat list path and each column.
 *
 * @param containers - Container-to-position map; `UNBOUND_POSITION` skips a container.
 * @param containerKeys - Container-to-stable-key map; a missing key skips the container.
 * @param resolveItem - Resolves the model value at a position.
 * @param render - Renders one resolved value to a React node.
 * @param out - The accumulator the bound triples are pushed onto.
 */
export const collectFlatBoundItems = (
    containers: ReadonlyMap<GObject.Object, number>,
    containerKeys: ReadonlyMap<GObject.Object, string>,
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

import { type RenderOptions, render } from "@gtkx/testing";
import type { ReactNode } from "react";

/**
 * Builds a widget subtree from a list of items.
 *
 * @typeParam T - Item type that the test maps to children of a wrapper widget.
 */
export type ChildrenBuilder<T> = (items: T[]) => ReactNode;

/** Handle returned by {@link renderChildren}. */
export interface RenderChildrenResult<T> {
    /** Re-renders the subtree built from a new list of items. */
    rerender: (items: T[]) => Promise<void>;
}

/**
 * Renders a widget subtree whose children are derived from a list, and
 * exposes a `rerender` that swaps the list while keeping the wrapper widget,
 * its ref, and the per-item mapping defined by `build` intact.
 *
 * The `build` callback owns the wrapper widget, its `ref`, and how each item
 * maps to a child, so a test only declares that mapping once and drives it
 * across renders by passing new item arrays.
 *
 * @typeParam T - Item type mapped to children by `build`.
 * @param initial - Items rendered on the first pass.
 * @param build - Maps a list of items to the full widget subtree.
 * @param options - Render options forwarded to every render pass.
 */
export const renderChildren = async <T,>(
    initial: T[],
    build: ChildrenBuilder<T>,
    options?: RenderOptions,
): Promise<RenderChildrenResult<T>> => {
    await render(build(initial), options);
    return {
        rerender: async (items: T[]) => {
            await render(build(items), options);
        },
    };
};

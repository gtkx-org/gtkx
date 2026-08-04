import type { ReactNode } from "react";
import type { RenderOptions } from "./types.js";
import { render } from "./render.js";

/** Builds the React tree for a list of items. */
type ChildrenBuilder<T> = (items: T[]) => ReactNode;

/**
 * The result of a {@link renderChildren} call.
 *
 * @typeParam T The item type the tree is built from.
 */
type RenderChildrenResult<T> = {
    /** Rebuilds the tree from a new list of items, reusing the same root. */
    rerender: (items: T[]) => Promise<void>;
};

/**
 * Renders a React tree built from a list of items, so that a test can rerender
 * the same tree with a different list without repeating the builder.
 *
 * @param initial The items the tree is first built from.
 * @param build Builds the React tree for a list of items.
 * @param options Optional container, wrapper, custom queries, and other render settings.
 * @returns A result whose `rerender` rebuilds the tree from new items.
 */
async function renderChildren<T>(
    initial: T[],
    build: ChildrenBuilder<T>,
    options?: RenderOptions,
): Promise<RenderChildrenResult<T>> {
    const { rerender } = await render(build(initial), options);

    return {
        rerender: async (items: T[]) => {
            await rerender(build(items));
        },
    };
}

export { renderChildren, type ChildrenBuilder, type RenderChildrenResult };

import type { ReactNode } from "react";
import type { RenderOptions } from "./types.js";
import { render } from "./render.js";

type ChildrenBuilder<T> = (items: T[]) => ReactNode;

type RenderChildrenResult<T> = {
    rerender: (items: T[]) => Promise<void>;
};

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

export { renderChildren, type ChildrenBuilder };

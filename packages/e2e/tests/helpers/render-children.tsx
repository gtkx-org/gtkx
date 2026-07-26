import type { ReactNode } from "react";
import { render, type RenderOptions } from "@gtkx/testing";

type ChildrenBuilder<T> = (items: T[]) => ReactNode;

type RenderChildrenResult<T> = {
    rerender: (items: T[]) => Promise<void>;
};

const renderChildren = async <T,>(
    initial: T[],
    build: ChildrenBuilder<T>,
    options?: RenderOptions,
): Promise<RenderChildrenResult<T>> => {
    const { rerender } = await render(build(initial), options);

    return {
        rerender: async (items: T[]) => {
            await rerender(build(items));
        },
    };
};

export { renderChildren, type ChildrenBuilder, type RenderChildrenResult };

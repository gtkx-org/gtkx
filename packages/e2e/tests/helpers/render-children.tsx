import type { ReactNode } from "react";
import { render, type RenderOptions } from "@gtkx/testing";

export type ChildrenBuilder<T> = (items: T[]) => ReactNode;

export type RenderChildrenResult<T> = {
    rerender: (items: T[]) => Promise<void>;
};

export const renderChildren = async <T,>(
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

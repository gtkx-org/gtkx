import { createRoot, type Root } from "@gtkx/react";
import type { ReactNode } from "react";

const settle = (): Promise<void> => new Promise((resolve) => setTimeout(resolve, 0));

const activeRoots = new Set<Root>();

export type ProductionRenderResult = {
    rerender: (element: ReactNode) => Promise<void>;
};

export const render = async (element: ReactNode): Promise<ProductionRenderResult> => {
    const root = createRoot();
    activeRoots.add(root);
    root.render(element);
    await settle();
    return {
        rerender: async (next: ReactNode): Promise<void> => {
            root.render(next);
            await settle();
        },
    };
};

export const cleanup = async (): Promise<void> => {
    for (const root of activeRoots) root.unmount();
    activeRoots.clear();
    await settle();
};

import type { ReactNode } from "react";
import { createRoot, type Root } from "@gtkx/react";

type ProductionRenderResult = {
    rerender: (element: ReactNode) => Promise<void>;
};

const activeRoots: Set<Root> = new Set();

const settle = (): Promise<void> => new Promise((resolve) => setTimeout(resolve, 0));

const render = async (element: ReactNode): Promise<ProductionRenderResult> => {
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

const cleanup = async (): Promise<void> => {
    for (const root of activeRoots) {
        root.unmount();
    }

    activeRoots.clear();
    await settle();
};

export { render, cleanup, type ProductionRenderResult };

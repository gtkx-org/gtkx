import { createRoot, type Root } from "@gtkx/react";
import type { ReactNode } from "react";

const settle = (): Promise<void> => new Promise((resolve) => setTimeout(resolve, 0));

const activeRoots = new Set<Root>();

export type ProductionRenderResult = {
    rerender: (element: ReactNode) => Promise<void>;
};

/**
 * Mounts `element` through the production reconciler (`@gtkx/react`'s `createRoot`,
 * with no test-only `act`), draining a macrotask so the reconciler's deferred
 * commit work has settled before returning. It mirrors the `render`/`cleanup`
 * surface of `@gtkx/testing` so the benchmarks can measure the real production
 * render path under `NODE_ENV=production`, where React omits `act`.
 */
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

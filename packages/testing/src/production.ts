import type * as Gtk from "@gtkx/gi/gtk";
import type { ReactNode } from "react";
import { createRoot, type Root } from "@gtkx/react";
import { createHarnessWindow } from "./harness-window.js";

/** The result of a production {@link render} call. */
type ProductionRenderResult = {
    /** Re-renders the tree with a new element, reusing the same root. */
    rerender: (element: ReactNode) => Promise<void>;
};

type ActiveRender = {
    root: Root;
    window: Gtk.Window;
};

const SETTLE_TURNS = 3;
const activeRenders: Set<ActiveRender> = new Set();

const turn = (): Promise<void> => new Promise((resolve) => setTimeout(resolve, 0));

const settle = async (): Promise<void> => {
    for (let index = 0; index < SETTLE_TURNS; index++) {
        await turn();
    }
};

/**
 * Renders a React element into a presented harness window and settles the main
 * loop, without React's act environment. Use it from benchmarks and other code
 * running against a production React build, where `act` is unavailable.
 *
 * @param element The React element to render.
 * @returns A result whose `rerender` updates the tree through the same root.
 */
const render = async (element: ReactNode): Promise<ProductionRenderResult> => {
    const window = createHarnessWindow();
    const root = createRoot(window);
    activeRenders.add({ root, window });
    root.render(element);
    window.present();
    await settle();

    return {
        rerender: async (next: ReactNode): Promise<void> => {
            root.render(next);
            await settle();
        },
    };
};

/**
 * Unmounts every tree started by {@link render}, destroys the harness windows,
 * and settles the main loop.
 */
const cleanup = async (): Promise<void> => {
    for (const active of activeRenders) {
        active.root.unmount();
        active.window.destroy();
    }

    activeRenders.clear();
    await settle();
};

export { render, cleanup, type ProductionRenderResult };

import type { ReactNode } from "react";
import * as Gtk from "@gtkx/gi/gtk";
import { createRoot, type Root } from "@gtkx/react";

type ProductionRenderResult = {
    rerender: (element: ReactNode) => Promise<void>;
};

type ActiveRender = {
    root: Root;
    window: Gtk.Window;
};

const HARNESS_WINDOW_WIDTH = 800;
const HARNESS_WINDOW_HEIGHT = 600;
const SETTLE_TURNS = 3;
const activeRenders: Set<ActiveRender> = new Set();

const turn = (): Promise<void> => new Promise((resolve) => setTimeout(resolve, 0));

const settle = async (): Promise<void> => {
    for (let index = 0; index < SETTLE_TURNS; index++) {
        await turn();
    }
};

const render = async (element: ReactNode): Promise<ProductionRenderResult> => {
    const window = new Gtk.Window({ defaultWidth: HARNESS_WINDOW_WIDTH, defaultHeight: HARNESS_WINDOW_HEIGHT });
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

const cleanup = async (): Promise<void> => {
    for (const active of activeRenders) {
        active.root.unmount();
        active.window.destroy();
    }

    activeRenders.clear();
    await settle();
};

export { render, cleanup, type ProductionRenderResult };

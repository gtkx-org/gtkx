import type * as Gtk from "@gtkx/gi/gtk";
import type { ReactNode } from "react";
import { createRoot, type Root } from "@gtkx/react";
import { createHarnessWindow } from "./harness-window.js";
import { delay } from "./timers.js";

type ProductionRenderResult = {
    rerender: (element: ReactNode) => Promise<void>;
};

type ActiveRender = {
    root: Root;
    window: Gtk.Window;
};

const SETTLE_TURNS = 3;
const activeRenders: Set<ActiveRender> = new Set();

const settle = async (): Promise<void> => {
    for (let index = 0; index < SETTLE_TURNS; index++) {
        await delay(0);
    }
};

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

const cleanup = async (): Promise<void> => {
    for (const active of activeRenders) {
        active.root.unmount();
        active.window.destroy();
    }

    activeRenders.clear();
    await settle();
};

export { cleanup, render };

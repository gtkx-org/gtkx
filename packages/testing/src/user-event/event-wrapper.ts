import * as Gtk from "@gtkx/gi/gtk";
import { runInAct } from "../act.js";

const ACTIONABLE_WAIT_LIMIT = 500;

const actionableHop = (): Promise<void> => new Promise((resolve) => setTimeout(resolve, 1));

const isActionable = (widget: Gtk.Widget): boolean => {
    const root = widget.getRoot();
    if (!(root instanceof Gtk.Window) || !root.getVisible()) return true;
    return root.getAllocatedWidth() > 0 && root.isActive() && widget.getMapped();
};

const waitForActionable = async (widget: Gtk.Widget): Promise<void> => {
    for (let attempt = 0; attempt < ACTIONABLE_WAIT_LIMIT; attempt++) {
        if (isActionable(widget)) return;
        await actionableHop();
    }
};

export const wrapEvent = (widget: Gtk.Widget, body: () => void | PromiseLike<void>): Promise<void> =>
    Promise.resolve()
        .then(() => waitForActionable(widget))
        .then(() =>
            runInAct(async () => {
                await body();
            }),
        );

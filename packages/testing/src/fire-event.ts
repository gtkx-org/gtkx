import type * as GObject from "@gtkx/gi/gobject";
import { runInAct } from "./act.js";

export const fireEvent = async (element: GObject.Object, signalName: string, ...args: unknown[]): Promise<void> => {
    await runInAct(() => {
        element.emit(signalName, ...args);
    });
};

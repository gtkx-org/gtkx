import type * as GObject from "@gtkx/gi/gobject";
import { getConfig } from "./config.js";

export const fireEvent = async (element: GObject.Object, signalName: string, ...args: unknown[]): Promise<void> => {
    await getConfig().eventWrapper(() => {
        element.emit(signalName, ...args);
    });
};

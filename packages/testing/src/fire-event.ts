import type * as GObject from "@gtkx/gi/gobject";
import { getConfig } from "./config.js";

/**
 * Emits `signalName` on `element` inside the configured event wrapper (React `act()` by default).
 *
 * @param element - The GObject instance to emit on.
 * @param signalName - The signal to emit.
 * @param args - The arguments forwarded to the signal.
 * @returns A promise that resolves once the emission (and any wrapper flushing) completes.
 */
export const fireEvent = async (element: GObject.Object, signalName: string, ...args: unknown[]): Promise<void> => {
    await getConfig().eventWrapper(() => {
        element.emit(signalName, ...args);
    });
};

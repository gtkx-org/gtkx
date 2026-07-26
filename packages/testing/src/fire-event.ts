import type * as GObject from "@gtkx/gi/gobject";
import { runInAct } from "./act.js";

/**
 * Emits a GObject signal on a widget or object inside React's act environment,
 * so any resulting state updates are flushed before the promise resolves.
 *
 * @param element The GObject instance to emit the signal on.
 * @param signalName Name of the signal to emit.
 * @param args Arguments passed to the signal handlers.
 */
const fireEvent = async (element: GObject.Object, signalName: string, ...args: unknown[]): Promise<void> => {
    await runInAct(() => {
        element.emit(signalName, ...args);
    });
};

export { fireEvent };

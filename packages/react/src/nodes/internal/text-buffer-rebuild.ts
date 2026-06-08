import * as Gtk from "@gtkx/gi/gtk";
import type { Instance } from "../../instance.js";

/**
 * The controller surface the registry shares with the reconciler: enough to
 * schedule a buffer rebuild and to tear the controller down. Decoupling the
 * concrete `TextBufferController` here keeps the reconciler's mutation hooks
 * from importing the controller (and its element/wrapper dependencies).
 */
export interface BufferRebuildHandle {
    /** Schedules a single buffer rebuild after the current commit drains. */
    scheduleRebuild(): void;
    /** Releases the controller's buffer signal handlers on teardown. */
    dispose(): void;
}

const controllers = new WeakMap<Gtk.TextView, BufferRebuildHandle>();

/**
 * Returns the rebuild handle registered for `view`, or `undefined`.
 *
 * @param view - The backing `Gtk.TextView`.
 */
export const findBufferHandle = (view: Gtk.TextView): BufferRebuildHandle | undefined => controllers.get(view);

/**
 * Registers `handle` as the controller owning `view`'s buffer.
 *
 * @param view - The backing `Gtk.TextView`.
 * @param handle - The controller's rebuild handle.
 */
export const setBufferHandle = (view: Gtk.TextView, handle: BufferRebuildHandle): void => {
    controllers.set(view, handle);
};

/**
 * Disposes and unregisters the controller owning `view`'s buffer, if any. Called
 * when the text view tears down so buffer signal handlers are released.
 *
 * @param view - The backing `Gtk.TextView` being torn down.
 */
export const disposeTextBufferController = (view: Gtk.TextView): void => {
    const handle = controllers.get(view);
    if (handle) {
        handle.dispose();
        controllers.delete(view);
    }
};

/**
 * Walks up from `node` to the enclosing `Gtk.TextView` and, when one is found
 * with an active controller, schedules a single buffer rebuild for it. Used by
 * the reconciler's universal text branches so any structural or content change
 * within a text view's buffered subtree refreshes the buffer.
 *
 * @param node - The instance whose buffered subtree changed.
 */
export const scheduleBufferRebuild = (node: Instance): void => {
    let current: Instance | null = node;
    while (current) {
        const backing = current.backingInstance;
        if (backing instanceof Gtk.TextView) {
            controllers.get(backing)?.scheduleRebuild();
            return;
        }
        current = current.parent;
    }
};

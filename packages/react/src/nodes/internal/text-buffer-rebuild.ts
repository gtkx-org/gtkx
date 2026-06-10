/**
 * Controller lookup and rebuild scheduling for `<GtkTextBuffer>` elements.
 *
 * Each buffer element instance lazily receives one
 * {@link TextBufferController} the first time content beneath it changes; the
 * controller linearizes the element's children into the backing
 * `Gtk.TextBuffer` once per commit.
 */
import * as Gtk from "@gtkx/gi/gtk";
import { closestInstance, type Instance } from "../../instance.js";
import { TextBufferController } from "./text-buffer-controller.js";

const controllers = new WeakMap<Instance, TextBufferController>();

/**
 * Walks up from `node` to the enclosing `<GtkTextBuffer>` element and, when one
 * exists, schedules a single end-of-commit rebuild of its content. Used by the
 * reconciler's mutation hooks so any structural or content change within a
 * buffered subtree refreshes the buffer.
 *
 * @param node - The instance whose buffered subtree changed.
 */
export const scheduleBufferRebuild = (node: Instance): void => {
    const owner = closestInstance(node, (instance) => instance.backingInstance instanceof Gtk.TextBuffer);
    if (!owner) return;
    let controller = controllers.get(owner);
    if (!controller) {
        controller = new TextBufferController(owner);
        controllers.set(owner, controller);
    }
    controller.scheduleRebuild();
};

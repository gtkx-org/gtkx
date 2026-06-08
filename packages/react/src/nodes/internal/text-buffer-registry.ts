import type * as Gtk from "@gtkx/gi/gtk";
import type { Node } from "../../node.js";
import { TextBufferController } from "./text-buffer-controller.js";
import { findBufferHandle, setBufferHandle } from "./text-buffer-rebuild.js";

/**
 * Returns the {@link TextBufferController} that owns `view`'s buffer, creating
 * and registering one on first access.
 *
 * @param owner - The `ElementNode` whose backing instance is `view`.
 * @param view - The backing `Gtk.TextView`.
 */
export const getTextBufferController = (owner: Node, view: Gtk.TextView): TextBufferController => {
    const existing = findBufferHandle(view);
    if (existing instanceof TextBufferController) return existing;
    const controller = new TextBufferController(owner, view);
    setBufferHandle(view, controller);
    return controller;
};

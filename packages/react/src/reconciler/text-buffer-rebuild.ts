import * as Gtk from "@gtkx/gi/gtk";
import { scheduleOwnerRebuild } from "./owner-rebuild.js";
import type { Node } from "./state.js";
import { TextBufferController } from "./text-buffer-controller.js";

/**
 * Schedules a content rebuild for the nearest enclosing `Gtk.TextBuffer` of `node`.
 *
 * @param node - The node whose owning text buffer should be rebuilt.
 */
export const scheduleBufferRebuild = (node: Node): void => {
    scheduleOwnerRebuild(
        node,
        (candidate) => candidate instanceof Gtk.TextBuffer,
        (owner) => new TextBufferController(owner).boundRebuild,
    );
};

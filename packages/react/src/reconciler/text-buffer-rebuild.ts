import * as Gtk from "@gtkx/gi/gtk";
import { scheduleOwnerRebuild } from "./owner-rebuild.js";
import type { Node } from "./state.js";
import { TextBufferController } from "./text-buffer-controller.js";

export const scheduleBufferRebuild = (node: Node): void => {
    scheduleOwnerRebuild(
        node,
        (candidate) => candidate instanceof Gtk.TextBuffer,
        (owner) => new TextBufferController(owner).boundRebuild,
    );
};

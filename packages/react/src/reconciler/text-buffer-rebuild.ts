import * as Gtk from "@gtkx/gi/gtk";
import { scheduleContentRebuild } from "./content-rebuild.js";
import type { Node } from "./state.js";
import { TextBufferController } from "./text-buffer-controller.js";

export const scheduleBufferRebuild = (node: Node): void => {
    scheduleContentRebuild(
        node,
        (candidate): candidate is Gtk.TextBuffer => candidate instanceof Gtk.TextBuffer,
        (owner) => new TextBufferController(owner).rebuild,
    );
};

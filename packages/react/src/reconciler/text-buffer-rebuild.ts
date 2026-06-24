import * as Gtk from "@gtkx/gi/gtk";
import { scheduleHostRebuild } from "./host-rebuild.js";
import type { Node } from "./state.js";
import { TextBufferController } from "./text-buffer-controller.js";

export const scheduleBufferRebuild = (node: Node): void => {
    scheduleHostRebuild(
        node,
        (candidate) => candidate instanceof Gtk.TextBuffer,
        (host) => new TextBufferController(host).boundRebuild,
    );
};

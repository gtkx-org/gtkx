import * as Gtk from "@gtkx/gi/gtk";
import { closestInstance, type Node } from "./state.js";
import { TextBufferController } from "./text-buffer-controller.js";

const controllers = new WeakMap<Node, TextBufferController>();

export const scheduleBufferRebuild = (node: Node): void => {
    const owner = closestInstance(node, (candidate) => candidate instanceof Gtk.TextBuffer);
    if (!owner) return;
    let controller = controllers.get(owner);
    if (!controller) {
        controller = new TextBufferController(owner);
        controllers.set(owner, controller);
    }
    controller.scheduleRebuild();
};

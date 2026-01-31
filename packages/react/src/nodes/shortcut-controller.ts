import type * as Gtk from "@gtkx/ffi/gtk";
import type { Node } from "../node.js";
import { EventControllerNode } from "./event-controller.js";
import { ShortcutNode } from "./shortcut.js";

export class ShortcutControllerNode extends EventControllerNode<Gtk.ShortcutController> {
    private shortcuts: ShortcutNode[] = [];

    public override appendChild(child: Node): void {
        if (!(child instanceof ShortcutNode)) {
            throw new Error(`ShortcutController only accepts Shortcut children, got '${child.typeName}'`);
        }

        this.shortcuts.push(child);
        this.addShortcutToController(child);
    }

    public override removeChild(child: Node): void {
        if (!(child instanceof ShortcutNode)) return;

        const index = this.shortcuts.indexOf(child);
        if (index !== -1) {
            this.shortcuts.splice(index, 1);
            if (child.shortcut) {
                this.container.removeShortcut(child.shortcut);
            }
        }
    }

    private addShortcutToController(node: ShortcutNode): void {
        node.createShortcut();
        if (node.shortcut) {
            this.container.addShortcut(node.shortcut);
        }
    }
}

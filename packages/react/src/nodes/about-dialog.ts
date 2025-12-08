import type * as Gtk from "@gtkx/ffi/gtk";
import { Node } from "../node.js";

export class AboutDialogNode extends Node<Gtk.AboutDialog> {
    static matches(type: string): boolean {
        return type === "AboutDialog";
    }

    override attachToParent(_parent: Node): void {
        // AboutDialog manages its own lifecycle - no-op
    }

    override attachToParentBefore(_parent: Node, _before: Node): void {
        // AboutDialog manages its own lifecycle - no-op
    }

    override detachFromParent(_parent: Node): void {
        this.widget.destroy();
    }

    override mount(): void {
        this.widget.present();
    }
}

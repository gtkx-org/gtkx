import type * as Gtk from "@gtkx/ffi/gtk";
import type { ChildContainer } from "../container-interfaces.js";
import { Node } from "../node.js";

export class ActionBarNode extends Node<Gtk.ActionBar> implements ChildContainer {
    static matches(type: string): boolean {
        return type === "ActionBar";
    }

    attachChild(child: Gtk.Widget): void {
        this.widget.packStart(child);
    }

    insertChildBefore(child: Gtk.Widget, _before: Gtk.Widget): void {
        // ActionBar doesn't support ordered insertion, just pack at start
        this.widget.packStart(child);
    }

    detachChild(child: Gtk.Widget): void {
        this.widget.remove(child);
    }
}

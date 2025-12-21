import type * as Gtk from "@gtkx/ffi/gtk";
import { PackContainerNode } from "./header-bar.js";

export class ActionBarNode extends PackContainerNode<Gtk.ActionBar> {
    static matches(type: string): boolean {
        return type === "GtkActionBar" || type === "GtkActionBar.Root";
    }
}

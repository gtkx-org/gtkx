import { getApplication } from "@gtkx/ffi";
import type * as Gtk from "@gtkx/ffi/gtk";
import { Node } from "../node.js";

export class AboutDialogNode extends Node<Gtk.AboutDialog> {
    static matches(type: string): boolean {
        return type === "GtkAboutDialog";
    }

    protected override isStandalone(): boolean {
        return true;
    }

    override mount(): void {
        this.widget.setTransientFor(getApplication().getActiveWindow() ?? undefined);
        this.widget.present();
    }

    override unmount(): void {
        this.widget.destroy();
        super.unmount();
    }
}

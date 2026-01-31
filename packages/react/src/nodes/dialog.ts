import type * as Adw from "@gtkx/ffi/adw";
import type * as Gtk from "@gtkx/ffi/gtk";
import { WidgetNode } from "./widget.js";

export class DialogNode extends WidgetNode<Adw.Dialog> {
    public parent: Gtk.Window | null = null;

    public override mount(): void {
        this.container.present(this.parent ?? undefined);
        super.mount();
    }

    public override unmount(): void {
        this.container.forceClose();
        super.unmount();
    }
}

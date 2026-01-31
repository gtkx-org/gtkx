import type * as Adw from "@gtkx/ffi/adw";
import type * as Gtk from "@gtkx/ffi/gtk";
import type { Props } from "../types.js";
import { WidgetNode } from "./widget.js";

export class DialogNode extends WidgetNode<Adw.Dialog> {
    public parentWindow: Gtk.Window | null = null;

    public override finalizeInitialChildren(props: Props): boolean {
        this.commitUpdate(null, props);
        return true;
    }

    public override commitMount(): void {
        this.container.present(this.parentWindow ?? undefined);
    }

    public override detachDeletedInstance(): void {
        this.container.forceClose();
        super.detachDeletedInstance();
    }
}

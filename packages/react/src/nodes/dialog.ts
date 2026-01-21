import * as Adw from "@gtkx/ffi/adw";
import type * as Gtk from "@gtkx/ffi/gtk";
import { registerNodeClass } from "../registry.js";
import type { Container, ContainerClass } from "../types.js";
import { matchesAnyClass } from "./internal/utils.js";
import { WidgetNode } from "./widget.js";

export class DialogNode extends WidgetNode<Adw.Dialog> {
    public static override priority = 1;

    public parent: Gtk.Window | null = null;

    public static override matches(_type: string, containerOrClass?: Container | ContainerClass | null): boolean {
        return matchesAnyClass([Adw.Dialog], containerOrClass);
    }

    public override mount(): void {
        this.container.present(this.parent ?? undefined);
        super.mount();
    }

    public override unmount(): void {
        this.container.forceClose();
        super.unmount();
    }
}

registerNodeClass(DialogNode);

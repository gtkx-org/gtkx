import type * as Adw from "@gtkx/ffi/adw";
import type { Props } from "../types.js";
import { WidgetNode } from "./widget.js";
import { WindowNode } from "./window.js";

export class DialogNode extends WidgetNode<Adw.Dialog> {
    public override finalizeInitialChildren(props: Props): boolean {
        this.commitUpdate(null, props);
        return true;
    }

    public override commitMount(): void {
        const parent = this.parent instanceof WindowNode ? this.parent.container : undefined;
        this.container.present(parent);
    }

    public override detachDeletedInstance(): void {
        this.container.forceClose();
        super.detachDeletedInstance();
    }
}

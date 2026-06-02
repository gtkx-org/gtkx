import type * as Adw from "@gtkx/gi/adw";
import type { Props } from "../types.js";
import { WidgetNode } from "./widget.js";
import { WindowNode } from "./window.js";

export class DialogNode extends WidgetNode<Adw.Dialog> {
    protected override shouldAttachToParent(): boolean {
        return false;
    }

    public override finalizeInitialChildren(props: Props): boolean {
        this.commitUpdate(null, props);
        return true;
    }

    public override commitMount(): void {
        const parent = this.parent instanceof WindowNode ? this.parent.backingInstance : null;
        this.backingInstance.present(parent);
    }

    public override detachDeletedInstance(): void {
        this.backingInstance.forceClose();
        super.detachDeletedInstance();
    }
}

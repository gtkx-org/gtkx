import type * as Gtk from "@gtkx/ffi/gtk";
import { registerNodeClass } from "../registry.js";
import type { PackableWidget } from "./pack.js";
import { SlotNode } from "./slot.js";

type PackChildPosition = "start" | "end";

export class PackChild extends SlotNode {
    public static override priority = 1;

    public static override matches(type: string): boolean {
        return type === "Pack.Start" || type === "Pack.End";
    }

    private getPosition(): PackChildPosition {
        return this.typeName === "Pack.Start" ? "start" : "end";
    }

    protected override onChildChange(oldChild: Gtk.Widget | undefined): void {
        const parent = this.getParent() as PackableWidget;

        if (oldChild) {
            parent.remove(oldChild);
        }

        if (this.child) {
            if (this.getPosition() === "start") {
                parent.packStart(this.child);
            } else {
                parent.packEnd(this.child);
            }
        }
    }
}

registerNodeClass(PackChild);

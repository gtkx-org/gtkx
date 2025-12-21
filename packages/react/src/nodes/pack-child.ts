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

    packableWidget?: PackableWidget;

    public setPackableWidget(packableWidget?: PackableWidget): void {
        this.packableWidget = packableWidget;
    }

    private getPosition(): PackChildPosition {
        return this.typeName === "Pack.Start" ? "start" : "end";
    }

    protected override onChildChange(oldChild: Gtk.Widget | undefined): void {
        if (!this.packableWidget) {
            throw new Error(`packableWidget is not set on ${this.typeName}`);
        }

        if (oldChild) {
            this.packableWidget.remove(oldChild);
        }

        if (this.child) {
            if (this.getPosition() === "start") {
                this.packableWidget.packStart(this.child);
            } else {
                this.packableWidget.packEnd(this.child);
            }
        }
    }
}

registerNodeClass(PackChild);

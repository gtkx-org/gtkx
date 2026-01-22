import { isObjectEqual } from "@gtkx/ffi";
import type * as Adw from "@gtkx/ffi/adw";
import type * as Gtk from "@gtkx/ffi/gtk";
import { registerNodeClass } from "../registry.js";
import { SlotNode } from "./slot.js";

type ToolbarChildNodePosition = "top" | "bottom";

class ToolbarChildNode extends SlotNode {
    public static override priority = 1;

    public static override matches(type: string): boolean {
        return type === "ToolbarTop" || type === "ToolbarBottom";
    }

    private getToolbar(): Adw.ToolbarView {
        if (!this.parent) {
            throw new Error("Expected ToolbarView reference to be set on ToolbarChildNode");
        }

        return this.parent as Adw.ToolbarView;
    }

    private getPosition(): ToolbarChildNodePosition {
        return this.typeName === "ToolbarTop" ? "top" : "bottom";
    }

    protected override onChildChange(oldChild: Gtk.Widget | null): void {
        const toolbar = this.getToolbar();

        if (oldChild) {
            const parent = oldChild.getParent();

            if (parent && isObjectEqual(parent, toolbar)) {
                toolbar.remove(oldChild);
            }
        }

        if (this.child) {
            const position = this.getPosition();

            if (position === "top") {
                toolbar.addTopBar(this.child);
            } else {
                toolbar.addBottomBar(this.child);
            }
        }
    }
}

registerNodeClass(ToolbarChildNode);

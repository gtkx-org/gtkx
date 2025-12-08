import type * as Gtk from "@gtkx/ffi/gtk";
import type { ChildContainer } from "../container-interfaces.js";
import { Node } from "../node.js";

const isFlowBoxChild = (widget: Gtk.Widget): widget is Gtk.FlowBoxChild =>
    "getIndex" in widget && "getChild" in widget && typeof (widget as Gtk.FlowBoxChild).getIndex === "function";

export class FlowBoxNode extends Node<Gtk.FlowBox> implements ChildContainer {
    static matches(type: string): boolean {
        return type === "FlowBox";
    }

    attachChild(child: Gtk.Widget): void {
        this.widget.append(child);
    }

    insertChildBefore(child: Gtk.Widget, before: Gtk.Widget): void {
        const beforeParent = before.getParent();
        if (beforeParent && isFlowBoxChild(beforeParent)) {
            this.widget.insert(child, beforeParent.getIndex());
        } else {
            this.widget.append(child);
        }
    }

    detachChild(child: Gtk.Widget): void {
        const flowBoxChild = child.getParent();
        if (flowBoxChild) {
            this.widget.remove(flowBoxChild);
        }
    }
}

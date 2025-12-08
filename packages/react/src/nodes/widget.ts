import type * as Gtk from "@gtkx/ffi/gtk";
import { isChildContainer } from "../container-interfaces.js";
import { Node } from "../node.js";

/**
 * Catch-all node for standard GTK widgets that don't need special handling.
 * Specialized widgets (Window, AboutDialog, ActionBar, FlowBox, ListBox, etc.)
 * are handled by their own dedicated Node classes.
 */
export class WidgetNode extends Node<Gtk.Widget> {
    static matches(_type: string): boolean {
        return true;
    }

    override attachToParent(parent: Node): void {
        if (isChildContainer(parent)) {
            parent.attachChild(this.widget);
            return;
        }

        super.attachToParent(parent);
    }

    override attachToParentBefore(parent: Node, before: Node): void {
        if (isChildContainer(parent)) {
            const beforeWidget = before.getWidget();

            if (beforeWidget) {
                parent.insertChildBefore(this.widget, beforeWidget);
            } else {
                parent.attachChild(this.widget);
            }

            return;
        }

        super.attachToParentBefore(parent, before);
    }

    override detachFromParent(parent: Node): void {
        if (isChildContainer(parent)) {
            parent.detachChild(this.widget);
            return;
        }

        super.detachFromParent(parent);
    }
}

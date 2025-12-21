import type * as Gtk from "@gtkx/ffi/gtk";
import type { ChildContainer } from "../containers.js";
import { Node } from "../node.js";

export class OverlayNode extends Node<Gtk.Overlay> implements ChildContainer {
    static matches(type: string): boolean {
        return type === "GtkOverlay" || type === "GtkOverlay.Root";
    }

    private mainChild: Gtk.Widget | null = null;
    private overlayChildren: Gtk.Widget[] = [];

    attachChild(childWidget: Gtk.Widget): void {
        if (this.mainChild === null) {
            this.mainChild = childWidget;
            this.widget.setChild(childWidget);
        } else {
            this.overlayChildren.push(childWidget);
            this.widget.addOverlay(childWidget);
        }
    }

    insertChildBefore(childWidget: Gtk.Widget, beforeWidget: Gtk.Widget): void {
        if (this.mainChild === null) {
            this.mainChild = childWidget;
            this.widget.setChild(childWidget);
            return;
        }

        if (this.mainChild === beforeWidget) {
            this.overlayChildren.unshift(childWidget);
            this.widget.addOverlay(childWidget);
            return;
        }

        const beforeIndex = this.overlayChildren.indexOf(beforeWidget);

        if (beforeIndex === -1) {
            this.attachChild(childWidget);
            return;
        }

        this.overlayChildren.splice(beforeIndex, 0, childWidget);
        this.widget.addOverlay(childWidget);
    }

    detachChild(childWidget: Gtk.Widget): void {
        if (this.mainChild === childWidget) {
            this.widget.setChild(undefined);
            this.mainChild = null;
        } else {
            const index = this.overlayChildren.indexOf(childWidget);

            if (index !== -1) {
                this.overlayChildren.splice(index, 1);
                this.widget.removeOverlay(childWidget);
            }
        }
    }
}

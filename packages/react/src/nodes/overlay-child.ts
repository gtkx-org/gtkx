import * as Gtk from "@gtkx/ffi/gtk";
import type { OverlayChildProps } from "../jsx.js";
import type { Node } from "../node.js";
import { AttachOnParentVirtualNode } from "./internal/attach-on-parent-virtual.js";
import { hasChanged } from "./internal/props.js";
import { unparentWidget } from "./internal/widget.js";
import { WidgetNode } from "./widget.js";

export class OverlayChildNode extends AttachOnParentVirtualNode<
    OverlayChildProps,
    WidgetNode<Gtk.Overlay>,
    WidgetNode
> {
    public override isValidChild(child: Node): boolean {
        return child instanceof WidgetNode;
    }

    public override isValidParent(parent: Node): boolean {
        return parent instanceof WidgetNode && parent.container instanceof Gtk.Overlay;
    }

    public override commitUpdate(oldProps: OverlayChildProps | null, newProps: OverlayChildProps): void {
        super.commitUpdate(oldProps, newProps);

        if (!this.parent) {
            return;
        }

        const measureChanged = hasChanged(oldProps, newProps, "measure");
        const clipOverlayChanged = hasChanged(oldProps, newProps, "clipOverlay");

        if (measureChanged || clipOverlayChanged) {
            const parent = this.parent.container;
            for (const child of this.children) {
                if (measureChanged) {
                    parent.setMeasureOverlay(child.container, newProps.measure ?? false);
                }
                if (clipOverlayChanged) {
                    parent.setClipOverlay(child.container, newProps.clipOverlay ?? false);
                }
            }
        }
    }

    protected override attachToParent(parent: Gtk.Overlay, child: Gtk.Widget): void {
        parent.addOverlay(child);

        if (this.props.measure !== undefined) {
            parent.setMeasureOverlay(child, this.props.measure);
        }

        if (this.props.clipOverlay !== undefined) {
            parent.setClipOverlay(child, this.props.clipOverlay);
        }
    }

    protected override detachFromParent(parent: Gtk.Overlay, child: Gtk.Widget): void {
        if (child.getParent() === parent) {
            parent.removeOverlay(child);
        } else {
            unparentWidget(child);
        }
    }
}

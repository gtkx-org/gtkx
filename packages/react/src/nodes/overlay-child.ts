import type * as Gtk from "@gtkx/ffi/gtk";
import type { OverlayChildProps } from "../jsx.js";
import type { Node } from "../node.js";
import { VirtualNode } from "./virtual.js";
import { WidgetNode } from "./widget.js";

type Props = Partial<OverlayChildProps>;

export class OverlayChildNode extends VirtualNode<Props, WidgetNode<Gtk.Overlay>, WidgetNode> {
    public override isValidChild(child: Node): boolean {
        return child instanceof WidgetNode;
    }

    public override setParent(parent: WidgetNode<Gtk.Overlay> | null): void {
        const previousParent = this.parent;
        super.setParent(parent);

        if (parent) {
            for (const child of this.children) {
                this.attachOverlayChild(parent.container, child.container);
            }
        } else if (previousParent) {
            this.detachAllOverlayChildren(previousParent.container);
        }
    }

    public override appendChild(child: Node): void {
        super.appendChild(child);

        if (this.parent) {
            this.attachOverlayChild(this.parent.container, (child as WidgetNode).container);
        }
    }

    public override insertBefore(child: Node, before: Node): void {
        super.insertBefore(child, before);

        if (this.parent) {
            this.attachOverlayChild(this.parent.container, (child as WidgetNode).container);
        }
    }

    public override removeChild(child: Node): void {
        if (this.parent) {
            const widget = (child as WidgetNode).container;
            const currentParent = widget.getParent();
            if (currentParent && currentParent === this.parent.container) {
                this.parent.container.removeOverlay(widget);
            }
        }

        super.removeChild(child);
    }

    public override detachDeletedInstance(): void {
        if (this.parent) {
            this.detachAllOverlayChildren(this.parent.container);
        }
        super.detachDeletedInstance();
    }

    public override commitUpdate(oldProps: Props | null, newProps: Props): void {
        super.commitUpdate(oldProps, newProps);

        if (!this.parent) {
            return;
        }

        const measureChanged = oldProps?.measure !== newProps.measure;
        const clipOverlayChanged = oldProps?.clipOverlay !== newProps.clipOverlay;

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

    private attachOverlayChild(overlay: Gtk.Overlay, widget: Gtk.Widget): void {
        overlay.addOverlay(widget);

        if (this.props.measure !== undefined) {
            overlay.setMeasureOverlay(widget, this.props.measure);
        }

        if (this.props.clipOverlay !== undefined) {
            overlay.setClipOverlay(widget, this.props.clipOverlay);
        }
    }

    private detachAllOverlayChildren(overlay: Gtk.Overlay): void {
        for (const child of this.children) {
            const currentParent = child.container.getParent();
            if (currentParent && currentParent === overlay) {
                overlay.removeOverlay(child.container);
            }
        }
    }
}

import * as Gtk from "@gtkx/ffi/gtk";
import type { OverlayChildProps } from "../jsx.js";
import type { Node } from "../node.js";
import { hasChanged } from "./internal/props.js";
import { unparentWidget } from "./internal/widget.js";
import { VirtualNode } from "./virtual.js";
import { WidgetNode } from "./widget.js";

export class OverlayChildNode extends VirtualNode<OverlayChildProps, WidgetNode<Gtk.Overlay>, WidgetNode> {
    public override isValidChild(child: Node): boolean {
        return child instanceof WidgetNode;
    }

    public override isValidParent(parent: Node): boolean {
        return parent instanceof WidgetNode && parent.container instanceof Gtk.Overlay;
    }

    public override setParent(parent: WidgetNode<Gtk.Overlay> | null): void {
        if (!parent && this.parent) {
            this.detachAllChildren(this.parent.container);
        }

        super.setParent(parent);

        if (parent) {
            for (const child of this.children) {
                this.attachToParent(parent.container, child.container);
            }
        }
    }

    public override appendChild(child: WidgetNode): void {
        super.appendChild(child);

        if (this.parent) {
            this.detachFromGtkParent(child);
            this.attachToParent(this.parent.container, child.container);
        }
    }

    public override insertBefore(child: WidgetNode, before: WidgetNode): void {
        super.insertBefore(child, before);

        if (this.parent) {
            this.reinsertAllChildren();
        }
    }

    public override removeChild(child: WidgetNode): void {
        this.detachFromGtkParent(child);
        super.removeChild(child);
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

    public override detachDeletedInstance(): void {
        if (this.parent) {
            this.detachAllChildren(this.parent.container);
        }
        super.detachDeletedInstance();
    }

    private attachToParent(parent: Gtk.Overlay, child: Gtk.Widget): void {
        parent.addOverlay(child);

        if (this.props.measure !== undefined) {
            parent.setMeasureOverlay(child, this.props.measure);
        }

        if (this.props.clipOverlay !== undefined) {
            parent.setClipOverlay(child, this.props.clipOverlay);
        }
    }

    private detachFromGtkParent(child: WidgetNode): void {
        const currentParent = child.container.getParent();
        if (currentParent instanceof Gtk.Overlay) {
            currentParent.removeOverlay(child.container);
        } else {
            unparentWidget(child.container);
        }
    }

    private reinsertAllChildren(): void {
        if (!this.parent) return;
        const parent = this.parent.container;

        for (const child of this.children) {
            this.detachFromGtkParent(child);
        }

        for (const child of this.children) {
            this.attachToParent(parent, child.container);
        }
    }

    private detachAllChildren(parent: Gtk.Overlay): void {
        for (const child of this.children) {
            if (child.container.getParent() === parent) {
                parent.removeOverlay(child.container);
            }
        }
    }
}

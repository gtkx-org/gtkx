import type * as Gtk from "@gtkx/ffi/gtk";
import type { OverlayChildProps } from "../jsx.js";
import type { Node } from "../node.js";
import { VirtualNode } from "./virtual.js";
import { WidgetNode } from "./widget.js";

type Props = Partial<OverlayChildProps>;

export class OverlayChildNode extends VirtualNode<Props> {
    private parentOverlay: Gtk.Overlay | null = null;
    private overlayChildren = new Set<Gtk.Widget>();

    public override onAddedToParent(parent: Node): void {
        if (parent instanceof WidgetNode) {
            this.parentOverlay = parent.container as Gtk.Overlay;
            for (const child of this.overlayChildren) {
                this.attachOverlayChild(child);
            }
        }
    }

    public override onRemovedFromParent(parent: Node): void {
        if (parent instanceof WidgetNode) {
            this.detachAllOverlayChildren(parent.container as Gtk.Overlay);
        }
        this.parentOverlay = null;
    }

    public override detachDeletedInstance(): void {
        if (this.parentOverlay) {
            this.detachAllOverlayChildren(this.parentOverlay);
        }
        this.overlayChildren.clear();
        this.parentOverlay = null;
        super.detachDeletedInstance();
    }

    private detachAllOverlayChildren(overlay: Gtk.Overlay): void {
        for (const child of this.overlayChildren) {
            const currentParent = child.getParent();
            if (currentParent && currentParent === overlay) {
                overlay.removeOverlay(child);
            }
        }
    }

    public override canAcceptChild(child: Node): boolean {
        return child instanceof WidgetNode;
    }

    public override appendChild(child: Node): void {
        if (!(child instanceof WidgetNode)) {
            throw new Error(`Cannot append '${child.typeName}' to '${this.typeName}': expected Widget`);
        }

        const widget = child.container;
        this.overlayChildren.add(widget);

        super.appendChild(child);

        if (this.parentOverlay) {
            this.attachOverlayChild(widget);
        }
    }

    public override insertBefore(child: Node, before: Node): void {
        if (!(child instanceof WidgetNode)) {
            throw new Error(`Cannot insert '${child.typeName}' into '${this.typeName}': expected Widget`);
        }

        const widget = child.container;
        this.overlayChildren.add(widget);

        super.insertBefore(child, before);

        if (this.parentOverlay) {
            this.attachOverlayChild(widget);
        }
    }

    public override removeChild(child: Node): void {
        if (!(child instanceof WidgetNode)) {
            throw new Error(`Cannot remove '${child.typeName}' from '${this.typeName}': expected Widget`);
        }

        const widget = child.container;
        const parent = this.parentOverlay;
        this.overlayChildren.delete(widget);

        if (parent) {
            const currentParent = widget.getParent();
            if (currentParent && currentParent === parent) {
                parent.removeOverlay(widget);
            }
        }

        super.removeChild(child);
    }

    public override commitUpdate(oldProps: Props | null, newProps: Props): void {
        super.commitUpdate(oldProps, newProps);

        if (!this.parentOverlay) {
            return;
        }

        const measureChanged = oldProps?.measure !== newProps.measure;
        const clipOverlayChanged = oldProps?.clipOverlay !== newProps.clipOverlay;

        if (measureChanged || clipOverlayChanged) {
            const parent = this.parentOverlay;
            for (const child of this.overlayChildren) {
                if (measureChanged) {
                    parent.setMeasureOverlay(child, newProps.measure ?? false);
                }
                if (clipOverlayChanged) {
                    parent.setClipOverlay(child, newProps.clipOverlay ?? false);
                }
            }
        }
    }

    private attachOverlayChild(widget: Gtk.Widget): void {
        if (!this.parentOverlay) {
            return;
        }

        this.parentOverlay.addOverlay(widget);

        if (this.props.measure !== undefined) {
            this.parentOverlay.setMeasureOverlay(widget, this.props.measure);
        }

        if (this.props.clipOverlay !== undefined) {
            this.parentOverlay.setClipOverlay(widget, this.props.clipOverlay);
        }
    }
}

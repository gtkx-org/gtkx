import * as Gtk from "@gtkx/ffi/gtk";
import type { OverlayChildProps } from "../jsx.js";
import type { Node } from "../node.js";
import { registerNodeClass } from "../registry.js";
import type { Container, ContainerClass } from "../types.js";
import { isContainerType } from "./internal/helpers.js";
import { SlotNode } from "./slot.js";
import { WidgetNode } from "./widget.js";

type Props = Partial<OverlayChildProps>;

class OverlaySlotNode extends SlotNode<Props> {
    public static override priority = 1;

    public static override matches(type: string): boolean {
        return type === "Overlay";
    }

    private getOverlay(): Gtk.Overlay {
        if (!this.parent) {
            throw new Error("Parent is not set on OverlaySlotNode");
        }

        return this.parent as Gtk.Overlay;
    }

    protected override onChildChange(oldChild: Gtk.Widget | undefined): void {
        const overlay = this.getOverlay();

        if (oldChild) {
            overlay.removeOverlay(oldChild);
        }

        if (this.child) {
            overlay.addOverlay(this.child);

            if (this.props.measure !== undefined) {
                overlay.setMeasureOverlay(this.child, this.props.measure);
            }

            if (this.props.clipOverlay !== undefined) {
                overlay.setClipOverlay(this.child, this.props.clipOverlay);
            }
        }
    }

    public override updateProps(oldProps: Props | null, newProps: Props): void {
        super.updateProps(oldProps, newProps);

        if (!this.parent || !this.child) {
            return;
        }

        const overlay = this.getOverlay();

        if (oldProps?.measure !== newProps.measure && newProps.measure !== undefined) {
            overlay.setMeasureOverlay(this.child, newProps.measure);
        }

        if (oldProps?.clipOverlay !== newProps.clipOverlay && newProps.clipOverlay !== undefined) {
            overlay.setClipOverlay(this.child, newProps.clipOverlay);
        }
    }
}

export class OverlayNode extends WidgetNode<Gtk.Overlay> {
    public static override priority = 1;

    public static override matches(_type: string, containerOrClass?: Container | ContainerClass): boolean {
        return isContainerType(Gtk.Overlay, containerOrClass);
    }

    public override appendChild(child: Node): void {
        if (child instanceof OverlaySlotNode) {
            child.setParent(this.container);
            return;
        }

        super.appendChild(child);
    }

    public override insertBefore(child: Node, before: Node): void {
        if (child instanceof OverlaySlotNode) {
            child.setParent(this.container);
            return;
        }

        super.insertBefore(child, before);
    }

    public override removeChild(child: Node): void {
        if (child instanceof OverlaySlotNode) {
            child.setParent(undefined);
            return;
        }

        super.removeChild(child);
    }
}

registerNodeClass(OverlayNode);
registerNodeClass(OverlaySlotNode);

import { getNativeId, isObjectEqual } from "@gtkx/ffi";
import type * as Gtk from "@gtkx/ffi/gtk";
import type { OverlayChildProps } from "../jsx.js";
import type { Node } from "../node.js";
import { registerNodeClass } from "../registry.js";
import { CommitPriority, scheduleAfterCommit } from "../scheduler.js";
import type { Attachable } from "./internal/predicates.js";
import { VirtualNode } from "./virtual.js";
import { WidgetNode } from "./widget.js";

type Props = Partial<OverlayChildProps>;

class OverlayChildNode extends VirtualNode<Props> implements Attachable {
    public static override priority = 1;

    public static override matches(type: string): boolean {
        return type === "OverlayChild";
    }

    private parent: Gtk.Overlay | null = null;
    private children = new Map<number, Gtk.Widget>();

    public canBeChildOf(parent: Node): boolean {
        return parent instanceof WidgetNode;
    }

    public attachTo(parent: Node): void {
        if (parent instanceof WidgetNode) {
            this.parent = parent.container as Gtk.Overlay;
        }
    }

    public detachFrom(_parent: Node): void {}

    public override unmount(): void {
        if (this.parent && this.children.size > 0) {
            const parent = this.parent;
            const children = [...this.children.values()];
            this.children.clear();

            for (const child of children) {
                const currentParent = child.getParent();
                if (currentParent && isObjectEqual(currentParent, parent)) {
                    parent.removeOverlay(child);
                }
            }
        }

        this.parent = null;
        super.unmount();
    }

    public override appendChild(child: Node): void {
        if (!(child instanceof WidgetNode)) {
            throw new Error(`Cannot append '${child.typeName}' to '${this.typeName}': expected Widget`);
        }

        const widget = child.container;
        this.children.set(getNativeId(widget.handle), widget);

        scheduleAfterCommit(() => {
            if (this.parent) {
                this.attachChild(widget);
            }
        }, CommitPriority.NORMAL);
    }

    public override insertBefore(child: Node, _before: Node): void {
        if (!(child instanceof WidgetNode)) {
            throw new Error(`Cannot insert '${child.typeName}' into '${this.typeName}': expected Widget`);
        }

        const widget = child.container;
        this.children.set(getNativeId(widget.handle), widget);

        scheduleAfterCommit(() => {
            if (this.parent) {
                this.attachChild(widget);
            }
        }, CommitPriority.NORMAL);
    }

    public override removeChild(child: Node): void {
        if (!(child instanceof WidgetNode)) {
            throw new Error(`Cannot remove '${child.typeName}' from '${this.typeName}': expected Widget`);
        }

        const widget = child.container;
        const parent = this.parent;
        this.children.delete(getNativeId(widget.handle));

        scheduleAfterCommit(() => {
            if (parent) {
                const currentParent = widget.getParent();
                if (currentParent && isObjectEqual(currentParent, parent)) {
                    parent.removeOverlay(widget);
                }
            }
        }, CommitPriority.HIGH);
    }

    public override updateProps(oldProps: Props | null, newProps: Props): void {
        super.updateProps(oldProps, newProps);

        if (!this.parent) {
            return;
        }

        const measureChanged = oldProps?.measure !== newProps.measure;
        const clipOverlayChanged = oldProps?.clipOverlay !== newProps.clipOverlay;

        if (measureChanged || clipOverlayChanged) {
            const parent = this.parent;
            for (const child of this.children.values()) {
                if (measureChanged) {
                    parent.setMeasureOverlay(child, newProps.measure ?? false);
                }
                if (clipOverlayChanged) {
                    parent.setClipOverlay(child, newProps.clipOverlay ?? false);
                }
            }
        }
    }

    private attachChild(widget: Gtk.Widget): void {
        if (!this.parent) {
            return;
        }

        this.parent.addOverlay(widget);

        if (this.props.measure !== undefined) {
            this.parent.setMeasureOverlay(widget, this.props.measure);
        }

        if (this.props.clipOverlay !== undefined) {
            this.parent.setClipOverlay(widget, this.props.clipOverlay);
        }
    }
}

registerNodeClass(OverlayChildNode);

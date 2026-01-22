import type * as Gtk from "@gtkx/ffi/gtk";
import type { FixedChildProps } from "../jsx.js";
import { registerNodeClass } from "../registry.js";
import { PositionalChildNode } from "./abstract/positional-child.js";
import { hasChanged } from "./internal/utils.js";

type Props = Partial<FixedChildProps>;

class FixedChildNode extends PositionalChildNode<Props> {
    public static override priority = 1;

    public static override matches(type: string): boolean {
        return type === "FixedChild";
    }

    protected override onChildChange(oldChild: Gtk.Widget | null): void {
        super.onChildChange(oldChild);
        if (this.child) {
            this.applyTransform();
        }
    }

    protected override attachToParent(parent: Gtk.Widget, child: Gtk.Widget): void {
        const fixed = parent as Gtk.Fixed;
        const x = this.props.x ?? 0;
        const y = this.props.y ?? 0;
        fixed.put(child, x, y);
    }

    protected override detachFromParent(parent: Gtk.Widget, child: Gtk.Widget): void {
        (parent as Gtk.Fixed).remove(child);
    }

    public override updateProps(oldProps: Props | null, newProps: Props): void {
        super.updateProps(oldProps, newProps);
        this.applyOwnProps(oldProps, newProps);
    }

    protected applyOwnProps(oldProps: Props | null, newProps: Props): void {
        if (!this.parent || !this.child) {
            return;
        }

        const positionChanged = hasChanged(oldProps, newProps, "x") || hasChanged(oldProps, newProps, "y");

        if (positionChanged) {
            this.repositionChild();
        } else if (hasChanged(oldProps, newProps, "transform")) {
            this.applyTransform();
        }
    }

    private repositionChild(): void {
        const fixed = this.getTypedParent<Gtk.Fixed>();
        const child = this.child;

        if (!child) {
            return;
        }

        const x = this.props.x ?? 0;
        const y = this.props.y ?? 0;

        fixed.remove(child);
        fixed.put(child, x, y);
        this.applyTransform();
    }

    private applyTransform(): void {
        if (!this.child || !this.props.transform) {
            return;
        }

        const fixed = this.getTypedParent<Gtk.Fixed>();
        const layoutManager = fixed.getLayoutManager();

        if (!layoutManager) {
            return;
        }

        const layoutChild = layoutManager.getLayoutChild(this.child) as Gtk.FixedLayoutChild;
        layoutChild.setTransform(this.props.transform);
    }
}

registerNodeClass(FixedChildNode);

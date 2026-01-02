import { batch } from "@gtkx/ffi";
import type * as Gtk from "@gtkx/ffi/gtk";
import type { FixedChildProps } from "../jsx.js";
import { registerNodeClass } from "../registry.js";
import { SlotNode } from "./slot.js";

type Props = Partial<FixedChildProps>;

class FixedChildNode extends SlotNode<Props> {
    public static override priority = 1;

    public static override matches(type: string): boolean {
        return type === "FixedChild";
    }

    private getFixed(): Gtk.Fixed {
        if (!this.parent) {
            throw new Error("Expected Fixed reference to be set on FixedChildNode");
        }

        return this.parent as Gtk.Fixed;
    }

    public override updateProps(oldProps: Props | null, newProps: Props): void {
        super.updateProps(oldProps, newProps);

        if (!oldProps || oldProps.x !== newProps.x || oldProps.y !== newProps.y) {
            if (this.parent && this.child) {
                this.positionChild();
            }
        }
    }

    private positionChild(): void {
        const fixed = this.getFixed();
        const x = this.props.x ?? 0;
        const y = this.props.y ?? 0;

        if (this.child) {
            const child = this.child;

            batch(() => {
                const currentParent = child.getParent();

                if (currentParent?.equals(fixed)) {
                    fixed.remove(child);
                }

                fixed.put(child, x, y);
            });
        }
    }

    protected override onChildChange(oldChild: Gtk.Widget | null): void {
        const fixed = this.getFixed();

        if (oldChild) {
            const parent = oldChild.getParent();

            if (parent?.equals(fixed)) {
                fixed.remove(oldChild);
            }
        }

        if (this.child) {
            this.positionChild();
        }
    }
}

registerNodeClass(FixedChildNode);

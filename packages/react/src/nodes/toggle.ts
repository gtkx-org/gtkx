import * as Adw from "@gtkx/ffi/adw";
import type { ToggleProps } from "../jsx.js";
import type { Node } from "../node.js";
import { hasChanged } from "./internal/props.js";
import { VirtualNode } from "./virtual.js";
import { WidgetNode } from "./widget.js";

export class ToggleNode extends VirtualNode<ToggleProps, WidgetNode<Adw.ToggleGroup>, never> {
    private toggle: Adw.Toggle | null = null;

    public override isValidChild(_child: Node): boolean {
        return false;
    }

    public override isValidParent(parent: Node): boolean {
        return parent instanceof WidgetNode && parent.container instanceof Adw.ToggleGroup;
    }

    public override setParent(parent: WidgetNode<Adw.ToggleGroup> | null): void {
        if (!parent && this.parent) {
            this.removeFromGroup();
        }

        super.setParent(parent);

        if (parent && !this.toggle) {
            this.toggle = new Adw.Toggle();
            this.applyOwnProps(null, this.props);
            parent.container.add(this.toggle);
        }
    }

    public override commitUpdate(oldProps: ToggleProps | null, newProps: ToggleProps): void {
        super.commitUpdate(oldProps, newProps);
        this.applyOwnProps(oldProps, newProps);
    }

    public override detachDeletedInstance(): void {
        this.removeFromGroup();
        super.detachDeletedInstance();
    }

    private removeFromGroup(): void {
        if (!this.parent || !this.toggle) return;

        this.parent.container.remove(this.toggle);
        this.toggle = null;
    }

    private applyOwnProps(oldProps: ToggleProps | null, newProps: ToggleProps): void {
        if (!this.toggle) return;

        if (hasChanged(oldProps, newProps, "id")) {
            this.toggle.setName(newProps.id ?? "");
        }
        if (hasChanged(oldProps, newProps, "label")) {
            this.toggle.setLabel(newProps.label ?? "");
        }
        if (hasChanged(oldProps, newProps, "iconName")) {
            this.toggle.setIconName(newProps.iconName ?? "");
        }
        if (hasChanged(oldProps, newProps, "tooltip")) {
            this.toggle.setTooltip(newProps.tooltip ?? "");
        }
        if (hasChanged(oldProps, newProps, "enabled")) {
            this.toggle.setEnabled(newProps.enabled ?? true);
        }
        if (hasChanged(oldProps, newProps, "useUnderline")) {
            this.toggle.setUseUnderline(newProps.useUnderline ?? false);
        }
    }
}

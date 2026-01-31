import * as Adw from "@gtkx/ffi/adw";
import type { ToggleProps } from "../jsx.js";
import { hasChanged } from "./internal/utils.js";
import { VirtualNode } from "./virtual.js";
import type { WidgetNode } from "./widget.js";

export class ToggleNode extends VirtualNode<ToggleProps, WidgetNode<Adw.ToggleGroup>> {
    private toggle: Adw.Toggle | null = null;

    public override setParent(parent: WidgetNode<Adw.ToggleGroup> | null): void {
        if (parent !== null) {
            super.setParent(parent);

            if (!this.toggle) {
                this.toggle = new Adw.Toggle();
                this.applyOwnProps(null, this.props);
                parent.container.add(this.toggle);
            }
        } else {
            this.removeFromGroup();
            super.setParent(parent);
        }
    }

    private removeFromGroup(): void {
        if (!this.parent || !this.toggle) return;

        this.parent.container.remove(this.toggle);
        this.toggle = null;
    }

    public override commitUpdate(oldProps: ToggleProps | null, newProps: ToggleProps): void {
        super.commitUpdate(oldProps, newProps);
        this.applyOwnProps(oldProps, newProps);
    }

    private applyOwnProps(oldProps: ToggleProps | null, newProps: ToggleProps): void {
        if (!this.toggle) return;

        if (hasChanged(oldProps, newProps, "id") && newProps.id !== undefined) {
            this.toggle.setName(newProps.id);
        }
        if (hasChanged(oldProps, newProps, "label") && newProps.label !== undefined) {
            this.toggle.setLabel(newProps.label);
        }
        if (hasChanged(oldProps, newProps, "iconName") && newProps.iconName !== undefined) {
            this.toggle.setIconName(newProps.iconName);
        }
        if (hasChanged(oldProps, newProps, "tooltip") && newProps.tooltip !== undefined) {
            this.toggle.setTooltip(newProps.tooltip);
        }
        if (hasChanged(oldProps, newProps, "enabled") && newProps.enabled !== undefined) {
            this.toggle.setEnabled(newProps.enabled);
        }
        if (hasChanged(oldProps, newProps, "useUnderline") && newProps.useUnderline !== undefined) {
            this.toggle.setUseUnderline(newProps.useUnderline);
        }
    }

    public override detachDeletedInstance(): void {
        this.removeFromGroup();
        super.detachDeletedInstance();
    }
}

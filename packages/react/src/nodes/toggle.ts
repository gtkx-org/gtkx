import * as Adw from "@gtkx/ffi/adw";
import type { ToggleProps } from "../jsx.js";
import type { Node } from "../node.js";
import { hasChanged } from "./internal/utils.js";
import { VirtualNode } from "./virtual.js";
import { WidgetNode } from "./widget.js";

export class ToggleNode extends VirtualNode<ToggleProps> {
    private toggleGroup: Adw.ToggleGroup | null = null;
    private toggle: Adw.Toggle | null = null;

    public override onAddedToParent(parent: Node): void {
        if (!(parent instanceof WidgetNode) || !(parent.container instanceof Adw.ToggleGroup)) {
            return;
        }

        if (this.toggle) return;

        this.toggleGroup = parent.container;
        this.toggle = new Adw.Toggle();
        this.applyOwnProps(null, this.props);
        this.toggleGroup.add(this.toggle);
    }

    public override onRemovedFromParent(_parent: Node): void {
        this.removeFromGroup();
    }

    private removeFromGroup(): void {
        if (!this.toggleGroup || !this.toggle) return;

        this.toggleGroup.remove(this.toggle);
        this.toggleGroup = null;
        this.toggle = null;
    }

    public override commitUpdate(oldProps: ToggleProps | null, newProps: ToggleProps): void {
        super.commitUpdate(oldProps, newProps);
        this.applyOwnProps(oldProps, newProps);
    }

    protected applyOwnProps(oldProps: ToggleProps | null, newProps: ToggleProps): void {
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

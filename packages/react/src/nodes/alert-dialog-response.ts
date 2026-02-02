import * as Adw from "@gtkx/ffi/adw";
import type { AlertDialogResponseProps } from "../jsx.js";
import type { Node } from "../node.js";
import { hasChanged } from "./internal/props.js";
import { VirtualNode } from "./virtual.js";
import { WidgetNode } from "./widget.js";

export class AlertDialogResponseNode extends VirtualNode<AlertDialogResponseProps, WidgetNode<Adw.AlertDialog>> {
    private responseId: string | null = null;

    public override isValidParent(parent: Node): boolean {
        return parent instanceof WidgetNode && parent.container instanceof Adw.AlertDialog;
    }

    public override setParent(parent: WidgetNode<Adw.AlertDialog> | null): void {
        if (!parent && this.parent) {
            this.removeFromDialog();
        }

        super.setParent(parent);

        if (parent && !this.responseId) {
            this.responseId = this.props.id;
            parent.container.addResponse(this.responseId, this.props.label);
            this.applyOwnProps(null, this.props);
        }
    }

    public override commitUpdate(oldProps: AlertDialogResponseProps | null, newProps: AlertDialogResponseProps): void {
        super.commitUpdate(oldProps, newProps);

        if (!this.parent || !this.responseId) return;

        if (hasChanged(oldProps, newProps, "id")) {
            const oldId = this.responseId;
            const newId = newProps.id;
            const label = newProps.label;

            this.parent.container.removeResponse(oldId);
            this.responseId = newId;
            this.parent.container.addResponse(newId, label);
            this.applyOwnProps(null, newProps);
            return;
        }

        if (hasChanged(oldProps, newProps, "label")) {
            this.parent.container.setResponseLabel(this.responseId, newProps.label);
        }

        this.applyOwnProps(oldProps, newProps);
    }

    public override detachDeletedInstance(): void {
        this.removeFromDialog();
        super.detachDeletedInstance();
    }

    private removeFromDialog(): void {
        if (!this.parent || !this.responseId) return;

        this.parent.container.removeResponse(this.responseId);
        this.responseId = null;
    }

    private applyOwnProps(oldProps: AlertDialogResponseProps | null, newProps: AlertDialogResponseProps): void {
        if (!this.parent || !this.responseId) return;

        if (hasChanged(oldProps, newProps, "appearance")) {
            this.parent.container.setResponseAppearance(
                this.responseId,
                newProps.appearance ?? Adw.ResponseAppearance.DEFAULT,
            );
        }
        if (hasChanged(oldProps, newProps, "enabled")) {
            this.parent.container.setResponseEnabled(this.responseId, newProps.enabled ?? true);
        }
    }
}

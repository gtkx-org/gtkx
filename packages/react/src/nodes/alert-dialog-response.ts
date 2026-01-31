import * as Adw from "@gtkx/ffi/adw";
import type { AlertDialogResponseProps } from "../jsx.js";
import type { Node } from "../node.js";
import { hasChanged } from "./internal/utils.js";
import { VirtualNode } from "./virtual.js";
import { WidgetNode } from "./widget.js";

export class AlertDialogResponseNode extends VirtualNode<AlertDialogResponseProps> {
    private dialog: Adw.AlertDialog | null = null;
    private responseId: string | null = null;

    public override setParent(parent: Node | null): void {
        if (parent !== null) {
            super.setParent(parent);

            if (parent instanceof WidgetNode && parent.container instanceof Adw.AlertDialog && !this.dialog) {
                this.dialog = parent.container;
                this.responseId = this.props.id;
                this.dialog.addResponse(this.responseId, this.props.label);
                this.applyOptionalProps(null, this.props);
            }
        } else {
            this.removeFromDialog();
            super.setParent(parent);
        }
    }

    private removeFromDialog(): void {
        if (!this.dialog || !this.responseId) return;

        this.dialog.removeResponse(this.responseId);
        this.dialog = null;
        this.responseId = null;
    }

    public override commitUpdate(oldProps: AlertDialogResponseProps | null, newProps: AlertDialogResponseProps): void {
        super.commitUpdate(oldProps, newProps);

        if (!this.dialog || !this.responseId) return;

        if (hasChanged(oldProps, newProps, "id")) {
            const oldId = this.responseId;
            const newId = newProps.id;
            const label = newProps.label;

            this.dialog.removeResponse(oldId);
            this.responseId = newId;
            this.dialog.addResponse(newId, label);
            this.applyOptionalProps(null, newProps);
            return;
        }

        if (hasChanged(oldProps, newProps, "label")) {
            this.dialog.setResponseLabel(this.responseId, newProps.label);
        }

        this.applyOptionalProps(oldProps, newProps);
    }

    private applyOptionalProps(oldProps: AlertDialogResponseProps | null, newProps: AlertDialogResponseProps): void {
        if (!this.dialog || !this.responseId) return;

        if (hasChanged(oldProps, newProps, "appearance") && newProps.appearance !== undefined) {
            this.dialog.setResponseAppearance(this.responseId, newProps.appearance);
        }
        if (hasChanged(oldProps, newProps, "enabled") && newProps.enabled !== undefined) {
            this.dialog.setResponseEnabled(this.responseId, newProps.enabled);
        }
    }

    public override detachDeletedInstance(): void {
        this.removeFromDialog();
        super.detachDeletedInstance();
    }
}

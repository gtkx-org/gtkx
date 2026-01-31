import * as Adw from "@gtkx/ffi/adw";
import type { AlertDialogResponseProps } from "../jsx.js";
import type { Node } from "../node.js";
import { CommitPriority, scheduleAfterCommit } from "../scheduler.js";
import { hasChanged } from "./internal/utils.js";
import { VirtualNode } from "./virtual.js";
import { WidgetNode } from "./widget.js";

export class AlertDialogResponseNode extends VirtualNode<AlertDialogResponseProps> {
    private dialog: Adw.AlertDialog | null = null;
    private responseId: string | null = null;

    public canBeChildOf(parent: Node): boolean {
        return parent instanceof WidgetNode && parent.container instanceof Adw.AlertDialog;
    }

    public attachTo(parent: Node): void {
        if (!(parent instanceof WidgetNode) || !(parent.container instanceof Adw.AlertDialog)) {
            return;
        }

        if (this.dialog) return;

        this.dialog = parent.container;
        this.responseId = this.props.id;
        const dialog = this.dialog;
        const id = this.responseId;
        const label = this.props.label;

        scheduleAfterCommit(() => {
            if (this.dialog) {
                dialog.addResponse(id, label);
                this.applyOptionalProps(null, this.props);
            }
        }, CommitPriority.NORMAL);
    }

    public detachFrom(_parent: Node): void {
        this.removeFromDialog();
    }

    private removeFromDialog(): void {
        if (!this.dialog || !this.responseId) return;

        const dialog = this.dialog;
        const id = this.responseId;
        this.dialog = null;
        this.responseId = null;

        scheduleAfterCommit(() => {
            dialog.removeResponse(id);
        }, CommitPriority.HIGH);
    }

    public override updateProps(oldProps: AlertDialogResponseProps | null, newProps: AlertDialogResponseProps): void {
        super.updateProps(oldProps, newProps);

        if (!this.dialog || !this.responseId) return;

        if (hasChanged(oldProps, newProps, "id")) {
            const oldId = this.responseId;
            const newId = newProps.id;
            const dialog = this.dialog;
            const label = newProps.label;

            this.responseId = newId;

            scheduleAfterCommit(() => {
                dialog.removeResponse(oldId);
                dialog.addResponse(newId, label);
                this.applyOptionalProps(null, newProps);
            }, CommitPriority.NORMAL);
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

    public override unmount(): void {
        this.removeFromDialog();
        super.unmount();
    }
}

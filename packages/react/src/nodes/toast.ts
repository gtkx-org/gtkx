import * as Adw from "@gtkx/ffi/adw";
import type { ToastProps } from "../jsx.js";
import { registerNodeClass } from "../registry.js";
import { signalStore } from "./internal/signal-store.js";
import { VirtualNode } from "./virtual.js";

type Props = ToastProps;

export class ToastNode extends VirtualNode<Props> {
    public static override priority = 1;

    public static override matches(type: string): boolean {
        return type === "Toast";
    }

    private toast?: Adw.Toast;
    private parent?: Adw.ToastOverlay;

    public setParent(parent?: Adw.ToastOverlay): void {
        this.parent = parent;
    }

    private createToast(): Adw.Toast {
        const toast = new Adw.Toast(this.props.title);

        if (this.props.timeout !== undefined) {
            toast.setTimeout(this.props.timeout);
        }

        if (this.props.priority !== undefined) {
            toast.setPriority(this.props.priority);
        }

        if (this.props.buttonLabel) {
            toast.setButtonLabel(this.props.buttonLabel);
        }

        if (this.props.actionName) {
            toast.setActionName(this.props.actionName);
        }

        if (this.props.useMarkup !== undefined) {
            toast.setUseMarkup(this.props.useMarkup);
        }

        return toast;
    }

    private showToast(): void {
        if (!this.parent || this.toast) return;

        this.toast = this.createToast();

        if (this.props.onButtonClicked) {
            signalStore.set(this, this.toast, "button-clicked", () => {
                this.props.onButtonClicked?.();
            });
        }

        signalStore.set(this, this.toast, "dismissed", () => {
            this.props.onDismissed?.();
        });

        this.parent.addToast(this.toast);
    }

    public override updateProps(oldProps: Props | null, newProps: Props): void {
        super.updateProps(oldProps, newProps);

        if (!this.toast) return;

        if (!oldProps || oldProps.title !== newProps.title) {
            this.toast.setTitle(newProps.title);
        }

        if (!oldProps || oldProps.buttonLabel !== newProps.buttonLabel) {
            this.toast.setButtonLabel(newProps.buttonLabel);
        }

        if (!oldProps || oldProps.actionName !== newProps.actionName) {
            this.toast.setActionName(newProps.actionName);
        }

        if (!oldProps || oldProps.useMarkup !== newProps.useMarkup) {
            this.toast.setUseMarkup(newProps.useMarkup ?? false);
        }
    }

    public override mount(): void {
        super.mount();
        this.showToast();
    }

    public override unmount(): void {
        if (this.toast) {
            this.toast.dismiss();
            this.props.onDismissed?.();
        }

        this.parent = undefined;
        super.unmount();
    }
}

registerNodeClass(ToastNode);

import * as Adw from "@gtkx/ffi/adw";
import type * as Gtk from "@gtkx/ffi/gtk";
import type { StackPageProps } from "../jsx.js";
import { registerNodeClass } from "../registry.js";
import { SlotNode } from "./slot.js";

type Props = Partial<StackPageProps>;

export class StackPageNode extends SlotNode<Props> {
    public static override priority = 1;

    page?: Gtk.StackPage | Adw.ViewStackPage;

    public static override matches(type: string): boolean {
        return type === "StackPage";
    }

    public setStack(stack?: Gtk.Stack | Adw.ViewStack): void {
        this.setParent(stack);
    }

    private getStack(): Gtk.Stack | Adw.ViewStack {
        if (!this.parent) {
            throw new Error("Expected Stack reference to be set on StackPageNode");
        }

        return this.parent as Gtk.Stack | Adw.ViewStack;
    }

    public override updateProps(oldProps: Props | null, newProps: Props): void {
        if (!this.page) {
            return;
        }

        if (!oldProps || oldProps.title !== newProps.title) {
            this.page.setTitle(newProps.title ?? "");
        }

        if (!oldProps || oldProps.iconName !== newProps.iconName) {
            this.page.setIconName(newProps.iconName ?? "");
        }

        if (!oldProps || oldProps.needsAttention !== newProps.needsAttention) {
            this.page.setNeedsAttention(newProps.needsAttention ?? false);
        }

        if (!oldProps || oldProps.visible !== newProps.visible) {
            this.page.setVisible(newProps.visible ?? true);
        }

        if (!oldProps || oldProps.useUnderline !== newProps.useUnderline) {
            this.page.setUseUnderline(newProps.useUnderline ?? false);
        }

        if ("setBadgeNumber" in this.page && (!oldProps || oldProps.badgeNumber !== newProps.badgeNumber)) {
            this.page.setBadgeNumber?.(newProps.badgeNumber ?? 0);
        }
    }

    private addPage(): void {
        const child = this.getChild();
        const stack = this.getStack();

        let page: Gtk.StackPage | Adw.ViewStackPage;

        if (stack instanceof Adw.ViewStack) {
            if (this.props.title && this.props.iconName) {
                page = stack.addTitledWithIcon(child, this.props.title, this.props.iconName, this.props.name);
            } else if (this.props.title) {
                page = stack.addTitled(child, this.props.title, this.props.name);
            } else if (this.props.name) {
                page = stack.addNamed(child, this.props.name);
            } else {
                page = stack.add(child);
            }
        } else {
            if (this.props.name) {
                page = stack.addNamed(child, this.props.name);
            } else {
                page = stack.addChild(child);
            }

            if (this.props.title) {
                page.setTitle(this.props.title);
            }
            if (this.props.iconName) {
                page.setIconName(this.props.iconName);
            }
        }

        this.page = page;
        this.updateProps(null, this.props);
    }

    private removePage(): void {
        const stack = this.getStack();

        if (!this.page) {
            return;
        }

        stack.remove(this.page.getChild());
    }

    protected override onChildChange(): void {
        this.removePage();

        if (this.child) {
            this.addPage();
        }
    }
}

registerNodeClass(StackPageNode);

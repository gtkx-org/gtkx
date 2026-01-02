import * as Adw from "@gtkx/ffi/adw";
import type * as Gtk from "@gtkx/ffi/gtk";
import type { StackPageProps } from "../jsx.js";
import { registerNodeClass } from "../registry.js";
import { SlotNode } from "./slot.js";

type Props = Partial<StackPageProps>;

class StackPageNode extends SlotNode<Props> {
    public static override priority = 1;

    private page?: Gtk.StackPage | Adw.ViewStackPage;

    public static override matches(type: string): boolean {
        return type === "StackPage";
    }

    public override updateProps(oldProps: Props | null, newProps: Props): void {
        super.updateProps(oldProps, newProps);

        if (!this.page) {
            return;
        }

        if (newProps.title && (!oldProps || oldProps.title !== newProps.title)) {
            this.page.setTitle(newProps.title);
        }

        if (newProps.iconName && (!oldProps || oldProps.iconName !== newProps.iconName)) {
            this.page.setIconName(newProps.iconName);
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
        const parent = this.getParent() as Gtk.Stack | Adw.ViewStack;

        let page: Gtk.StackPage | Adw.ViewStackPage;

        if (parent instanceof Adw.ViewStack) {
            if (this.props.title && this.props.iconName) {
                page = parent.addTitledWithIcon(child, this.props.name, this.props.title, this.props.iconName);
            } else if (this.props.title) {
                page = parent.addTitled(child, this.props.name, this.props.title);
            } else if (this.props.name) {
                page = parent.addNamed(child, this.props.name);
            } else {
                page = parent.add(child);
            }
        } else {
            if (this.props.title) {
                page = parent.addTitled(child, this.props.name, this.props.title);
            } else if (this.props.name) {
                page = parent.addNamed(child, this.props.name);
            } else {
                page = parent.addChild(child);
            }
        }

        this.page = page;
        this.updateProps(null, this.props);
    }

    private removePage(oldChild: Gtk.Widget | null): void {
        const parent = this.getParent() as Gtk.Stack | Adw.ViewStack;

        if (!oldChild) {
            return;
        }

        const currentParent = oldChild.getParent();

        if (currentParent?.equals(parent)) {
            parent.remove(oldChild);
        }
    }

    protected override onChildChange(oldChild: Gtk.Widget | null): void {
        this.removePage(oldChild);

        if (this.child) {
            this.addPage();
        }
    }
}

registerNodeClass(StackPageNode);

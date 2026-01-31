import * as Adw from "@gtkx/ffi/adw";
import type * as Gtk from "@gtkx/ffi/gtk";
import type { StackPageProps } from "../jsx.js";
import { hasChanged } from "./internal/utils.js";
import { SlotNode } from "./slot.js";

type Props = Partial<StackPageProps>;

export class StackPageNode extends SlotNode<Props> {
    private page: Gtk.StackPage | Adw.ViewStackPage | null = null;

    public override commitUpdate(oldProps: Props | null, newProps: Props): void {
        super.commitUpdate(oldProps, newProps);
        this.applyOwnProps(oldProps, newProps);
    }

    protected applyOwnProps(oldProps: Props | null, newProps: Props): void {
        if (!this.page) {
            return;
        }

        if (hasChanged(oldProps, newProps, "title") && newProps.title !== undefined) {
            this.page.setTitle(newProps.title);
        }

        if (hasChanged(oldProps, newProps, "iconName") && newProps.iconName !== undefined) {
            this.page.setIconName(newProps.iconName);
        }

        if (hasChanged(oldProps, newProps, "needsAttention")) {
            this.page.setNeedsAttention(newProps.needsAttention ?? false);
        }

        if (hasChanged(oldProps, newProps, "visible")) {
            this.page.setVisible(newProps.visible ?? true);
        }

        if (hasChanged(oldProps, newProps, "useUnderline")) {
            this.page.setUseUnderline(newProps.useUnderline ?? false);
        }

        if ("setBadgeNumber" in this.page && hasChanged(oldProps, newProps, "badgeNumber")) {
            this.page.setBadgeNumber?.(newProps.badgeNumber ?? 0);
        }
    }

    protected override onChildChange(oldChild: Gtk.Widget | null): void {
        this.removePage(oldChild);

        if (this.childWidget) {
            this.addPage();
        }
    }

    private addPage(): void {
        const child = this.getChildWidget();
        const parent = this.getParentWidget() as Gtk.Stack | Adw.ViewStack;

        let page: Gtk.StackPage | Adw.ViewStackPage;

        if (parent instanceof Adw.ViewStack) {
            if (this.props.title && this.props.iconName) {
                page = parent.addTitledWithIcon(child, this.props.title, this.props.iconName, this.props.id);
            } else if (this.props.title) {
                page = parent.addTitled(child, this.props.title, this.props.id);
            } else if (this.props.id) {
                page = parent.addNamed(child, this.props.id);
            } else {
                page = parent.add(child);
            }
        } else {
            if (this.props.title) {
                page = parent.addTitled(child, this.props.title, this.props.id);
            } else if (this.props.id) {
                page = parent.addNamed(child, this.props.id);
            } else {
                page = parent.addChild(child);
            }
        }

        this.page = page;
        this.commitUpdate(null, this.props);
    }

    private removePage(oldChild: Gtk.Widget | null): void {
        const parent = this.getParentWidget() as Gtk.Stack | Adw.ViewStack;

        if (!oldChild) {
            return;
        }

        const currentParent = oldChild.getParent();

        if (currentParent && currentParent === parent) {
            parent.remove(oldChild);
        }
    }
}

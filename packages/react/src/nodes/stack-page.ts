import * as Adw from "@gtkx/ffi/adw";
import * as Gtk from "@gtkx/ffi/gtk";
import type { StackPageProps } from "../jsx.js";
import type { Node } from "../node.js";
import type { StackWidget } from "../registry.js";
import { hasChanged } from "./internal/props.js";
import { SingleChildVirtualNode } from "./internal/single-child-virtual.js";
import { removeChildFromParent } from "./internal/widget.js";
import { WidgetNode } from "./widget.js";

export class StackPageNode extends SingleChildVirtualNode<StackPageProps, WidgetNode<StackWidget>, WidgetNode> {
    private page: Gtk.StackPage | Adw.ViewStackPage | null = null;

    public override isValidChild(child: Node): boolean {
        return child instanceof WidgetNode;
    }

    public override isValidParent(parent: Node): boolean {
        return (
            parent instanceof WidgetNode &&
            (parent.container instanceof Gtk.Stack || parent.container instanceof Adw.ViewStack)
        );
    }

    public override commitUpdate(oldProps: StackPageProps | null, newProps: StackPageProps): void {
        super.commitUpdate(oldProps, newProps);
        this.applyOwnProps(oldProps, newProps);
    }

    private getChildWidget(): Gtk.Widget {
        const child = this.children[0];
        if (!child) {
            throw new Error("Expected child widget to be set on StackPageNode");
        }
        return child.container;
    }

    private getParentWidget(): StackWidget {
        if (!this.parent) {
            throw new Error("Expected parent widget to be set on StackPageNode");
        }
        return this.parent.container;
    }

    private applyOwnProps(oldProps: StackPageProps | null, newProps: StackPageProps): void {
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

        if (this.children[0]) {
            this.addPage();
        }
    }

    protected override onDetach(oldChild: Gtk.Widget | null): void {
        if (oldChild) this.removePage(oldChild);
        this.page = null;
    }

    private addPage(): void {
        const child = this.getChildWidget();
        const parent = this.getParentWidget();

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
        if (!oldChild) return;
        removeChildFromParent(this.getParentWidget(), oldChild);
    }
}

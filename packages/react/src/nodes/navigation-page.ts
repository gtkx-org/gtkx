import * as Adw from "@gtkx/ffi/adw";
import type * as Gtk from "@gtkx/ffi/gtk";
import { toCamelCase } from "@gtkx/gir";
import type { NavigationPageProps } from "../jsx.js";
import type { Node } from "../node.js";
import type { ContainerClass } from "../types.js";
import { hasChanged } from "./internal/props.js";
import { getFocusWidget, isDescendantOf, resolvePropertySetter } from "./internal/widget.js";
import { VirtualNode } from "./virtual.js";
import { WidgetNode } from "./widget.js";

export class NavigationPageNode extends VirtualNode<NavigationPageProps, WidgetNode, WidgetNode> {
    private wrappedPage: Adw.NavigationPage | null = null;

    public override isValidChild(child: Node): boolean {
        return child instanceof WidgetNode;
    }

    public override isValidParent(parent: Node): boolean {
        return parent instanceof WidgetNode;
    }

    public override setParent(parent: WidgetNode | null): void {
        if (!parent && this.parent && this.wrappedPage) {
            const parentWidget = this.getParentWidget();
            if (parentWidget instanceof Adw.NavigationView) {
                parentWidget.remove(this.wrappedPage);
            } else {
                this.applySlotChild(parentWidget, this.wrappedPage);
            }
            this.wrappedPage = null;
        }

        super.setParent(parent);

        if (parent && this.children[0]) {
            this.onChildChange(null);
        }
    }

    public override appendChild(child: WidgetNode): void {
        const oldChildWidget = this.children[0]?.container ?? null;
        super.appendChild(child);

        if (this.parent) {
            this.onChildChange(oldChildWidget);
        }
    }

    public override removeChild(child: WidgetNode): void {
        const oldChildWidget = child.container;
        super.removeChild(child);

        if (this.parent && oldChildWidget) {
            this.onChildChange(oldChildWidget);
        }
    }

    public override commitUpdate(oldProps: NavigationPageProps | null, newProps: NavigationPageProps): void {
        super.commitUpdate(oldProps, newProps);
        this.applyOwnProps(oldProps, newProps);
    }

    public override detachDeletedInstance(): void {
        if (this.parent && this.wrappedPage) {
            const parentWidget = this.getParentWidget();
            if (parentWidget instanceof Adw.NavigationView) {
                parentWidget.remove(this.wrappedPage);
            } else {
                this.applySlotChild(parentWidget, this.wrappedPage);
            }
        }
        this.wrappedPage = null;
        super.detachDeletedInstance();
    }

    private applyOwnProps(oldProps: NavigationPageProps | null, newProps: NavigationPageProps): void {
        if (!this.wrappedPage) {
            return;
        }

        if (hasChanged(oldProps, newProps, "id")) {
            this.wrappedPage.setTag(newProps.id);
        }

        if (hasChanged(oldProps, newProps, "title")) {
            this.wrappedPage.setTitle(newProps.title ?? "");
        }

        if (hasChanged(oldProps, newProps, "canPop")) {
            this.wrappedPage.setCanPop(newProps.canPop ?? true);
        }
    }

    private onChildChange(oldChild: Gtk.Widget | null): void {
        const parentWidget = this.getParentWidget();
        const title = this.props.title ?? "";
        const childWidget = this.children[0]?.container ?? null;

        if (childWidget) {
            const wrappedChild = this.props.id
                ? Adw.NavigationPage.newWithTag(childWidget, title, this.props.id)
                : new Adw.NavigationPage(childWidget, title);

            this.wrappedPage = wrappedChild;
            this.applyOwnProps(null, this.props);

            if (parentWidget instanceof Adw.NavigationView) {
                if (oldChild instanceof Adw.NavigationPage) {
                    parentWidget.remove(oldChild);
                }

                parentWidget.add(wrappedChild);
            } else {
                this.applySlotChild(parentWidget, oldChild);
            }
        } else if (parentWidget instanceof Adw.NavigationView) {
            if (oldChild instanceof Adw.NavigationPage) {
                parentWidget.remove(oldChild);
            }
            this.wrappedPage = null;
        } else {
            this.wrappedPage = null;
            this.applySlotChild(parentWidget, oldChild);
        }
    }

    private applySlotChild(parentWidget: Gtk.Widget, oldChild: Gtk.Widget | null): void {
        const propId = toCamelCase(this.props.id ?? "");
        const setter = resolvePropertySetter(parentWidget, propId);

        if (!setter) {
            const parentType = (parentWidget.constructor as ContainerClass).glibTypeName;
            throw new Error(`Unable to find property for slot '${propId}' on type '${parentType}'`);
        }

        if (oldChild && !this.wrappedPage) {
            const focus = getFocusWidget(oldChild);

            if (focus && isDescendantOf(focus, oldChild)) {
                parentWidget.grabFocus();
            }
        }

        setter(this.wrappedPage);
    }

    private getParentWidget(): Gtk.Widget {
        if (!this.parent) {
            throw new Error("Expected parent widget to be set on NavigationPageNode");
        }
        return this.parent.container;
    }
}

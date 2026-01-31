import * as Adw from "@gtkx/ffi/adw";
import type { NavigationPageProps } from "../jsx.js";
import { hasChanged } from "./internal/utils.js";
import { SlotNode } from "./slot.js";
import type { WidgetNode } from "./widget.js";

type Props = Partial<NavigationPageProps>;

export class NavigationPageNode extends SlotNode<Props> {
    private wrappedPage: Adw.NavigationPage | null = null;

    public override setParent(parent: WidgetNode | null): void {
        if (!parent && this.parent && this.wrappedPage) {
            const navigationView = this.parent.container;
            if (navigationView instanceof Adw.NavigationView) {
                navigationView.remove(this.wrappedPage);
            }
            this.wrappedPage = null;
        }

        super.setParent(parent);
    }

    public override detachDeletedInstance(): void {
        if (this.parent && this.wrappedPage) {
            const navigationView = this.parent.container;
            if (navigationView instanceof Adw.NavigationView) {
                navigationView.remove(this.wrappedPage);
            }
        }
        this.wrappedPage = null;
    }

    public override commitUpdate(oldProps: Props | null, newProps: Props): void {
        super.commitUpdate(oldProps, newProps);
        this.applyOwnProps(oldProps, newProps);
    }

    private applyOwnProps(oldProps: Props | null, newProps: Props): void {
        if (!this.wrappedPage) {
            return;
        }

        if (hasChanged(oldProps, newProps, "id") && newProps.id !== undefined) {
            this.wrappedPage.setTag(newProps.id);
        }

        if (hasChanged(oldProps, newProps, "title") && newProps.title !== undefined) {
            this.wrappedPage.setTitle(newProps.title);
        }

        if (hasChanged(oldProps, newProps, "canPop") && newProps.canPop !== undefined) {
            this.wrappedPage.setCanPop(newProps.canPop);
        }
    }

    public override onChildChange(oldChild: Adw.NavigationPage | null): void {
        const navigationView = this.getParentWidget() as Adw.NavigationView | Adw.NavigationSplitView;
        const title = this.props.title ?? "";
        const childWidget = this.children[0]?.container ?? null;

        if (childWidget) {
            const wrappedChild = this.props.id
                ? Adw.NavigationPage.newWithTag(childWidget, title, this.props.id)
                : new Adw.NavigationPage(childWidget, title);

            this.wrappedPage = wrappedChild;
            this.applyOwnProps(null, this.props);

            if (navigationView instanceof Adw.NavigationView) {
                if (oldChild instanceof Adw.NavigationPage) {
                    navigationView.remove(oldChild);
                }

                navigationView.add(wrappedChild);
            } else {
                super.onChildChange(oldChild);
            }
        } else if (navigationView instanceof Adw.NavigationView) {
            if (oldChild instanceof Adw.NavigationPage) {
                navigationView.remove(oldChild);
            }
            this.wrappedPage = null;
        } else {
            this.wrappedPage = null;
            super.onChildChange(oldChild);
        }
    }
}

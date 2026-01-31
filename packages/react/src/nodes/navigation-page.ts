import * as Adw from "@gtkx/ffi/adw";
import type { NavigationPageProps } from "../jsx.js";
import { hasChanged } from "./internal/utils.js";
import { SlotNode } from "./slot.js";

type Props = Partial<NavigationPageProps>;

export class NavigationPageNode extends SlotNode<Props> {
    public override commitUpdate(oldProps: Props | null, newProps: Props): void {
        super.commitUpdate(oldProps, newProps);
        this.applyOwnProps(oldProps, newProps);
    }

    protected applyOwnProps(oldProps: Props | null, newProps: Props): void {
        const child = this.childWidget;

        if (!(child instanceof Adw.NavigationPage)) {
            return;
        }

        if (hasChanged(oldProps, newProps, "id") && newProps.id !== undefined) {
            child.setTag(newProps.id);
        }

        if (hasChanged(oldProps, newProps, "title") && newProps.title !== undefined) {
            child.setTitle(newProps.title);
        }

        if (hasChanged(oldProps, newProps, "canPop") && newProps.canPop !== undefined) {
            child.setCanPop(newProps.canPop);
        }
    }

    protected override onChildChange(oldChild: Adw.NavigationPage | null): void {
        const navigationView = this.getParentWidget() as Adw.NavigationView | Adw.NavigationSplitView;
        const title = this.props.title ?? "";

        if (this.childWidget) {
            this.childWidget = this.props.id
                ? Adw.NavigationPage.newWithTag(this.childWidget, title, this.props.id)
                : new Adw.NavigationPage(this.childWidget, title);

            this.commitUpdate(null, this.props);
        }

        if (navigationView instanceof Adw.NavigationView) {
            if (oldChild instanceof Adw.NavigationPage) {
                navigationView.remove(oldChild);
            }

            if (this.childWidget) {
                navigationView.add(this.childWidget as Adw.NavigationPage);
            }
        } else {
            super.onChildChange(oldChild);
        }
    }
}

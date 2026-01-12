import * as Adw from "@gtkx/ffi/adw";
import type { NavigationPageProps } from "../jsx.js";
import { registerNodeClass } from "../registry.js";
import { SlotNode } from "./slot.js";

type Props = Partial<NavigationPageProps>;

export class NavigationPageNode extends SlotNode<Props> {
    public static override priority = 1;

    public static override matches(type: string): boolean {
        return type === "NavigationPage";
    }

    public override updateProps(oldProps: Props | null, newProps: Props): void {
        super.updateProps(oldProps, newProps);

        const child = this.child;

        if (!(child instanceof Adw.NavigationPage)) {
            return;
        }

        if (newProps.id !== undefined && (!oldProps || oldProps.id !== newProps.id)) {
            child.setTag(newProps.id);
        }

        if (newProps.title !== undefined && (!oldProps || oldProps.title !== newProps.title)) {
            child.setTitle(newProps.title);
        }

        if (newProps.canPop !== undefined && (!oldProps || oldProps.canPop !== newProps.canPop)) {
            child.setCanPop(newProps.canPop);
        }
    }

    protected override onChildChange(oldChild: Adw.NavigationPage | null): void {
        const navigationView = this.getParent() as Adw.NavigationView | Adw.NavigationSplitView;
        const title = this.props.title ?? "";

        if (this.child) {
            this.child = this.props.id
                ? Adw.NavigationPage.newWithTag(this.child, title, this.props.id)
                : new Adw.NavigationPage(this.child, title);

            this.updateProps(null, this.props);
        }

        if (navigationView instanceof Adw.NavigationView) {
            if (oldChild instanceof Adw.NavigationPage) {
                navigationView.remove(oldChild);
            }

            if (this.child) {
                navigationView.add(this.child as Adw.NavigationPage);
            }
        } else {
            super.onChildChange(oldChild);
        }
    }
}

registerNodeClass(NavigationPageNode);

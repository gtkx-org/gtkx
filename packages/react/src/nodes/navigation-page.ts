import * as Adw from "@gtkx/ffi/adw";
import type { NavigationPageProps } from "../jsx.js";
import { registerNodeClass } from "../registry.js";
import { hasChanged } from "./internal/utils.js";
import { SlotNode } from "./slot.js";

type Props = Partial<NavigationPageProps>;

export class NavigationPageNode extends SlotNode<Props> {
    public static override priority = 1;

    public static override matches(type: string): boolean {
        return type === "NavigationPage";
    }

    public override updateProps(oldProps: Props | null, newProps: Props): void {
        super.updateProps(oldProps, newProps);
        this.applyOwnProps(oldProps, newProps);
    }

    protected applyOwnProps(oldProps: Props | null, newProps: Props): void {
        const child = this.child;

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

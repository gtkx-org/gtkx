import type * as Adw from "@gtkx/ffi/adw";
import type * as Gtk from "@gtkx/ffi/gtk";
import { filterProps, hasChanged } from "./internal/utils.js";
import { WidgetNode } from "./widget.js";

const OWN_PROPS = ["page", "onPageChanged"] as const;

type StackWidget = Gtk.Stack | Adw.ViewStack;

type StackProps = {
    page?: string;
    onPageChanged?: ((page: string | null, self: StackWidget) => void) | null;
};

export class StackNode extends WidgetNode<StackWidget, StackProps> {
    protected override applyUpdate(oldProps: StackProps | null, newProps: StackProps): void {
        super.applyUpdate(oldProps ? filterProps(oldProps, OWN_PROPS) : null, filterProps(newProps, OWN_PROPS));
        this.applyOwnProps(oldProps, newProps);
    }

    protected applyOwnProps(oldProps: StackProps | null, newProps: StackProps): void {
        if (newProps.page && this.container.getVisibleChildName() !== newProps.page) {
            const page = newProps.page;
            if (this.container.getChildByName(page)) {
                this.container.setVisibleChildName(page);
            }
        }

        if (hasChanged(oldProps, newProps, "onPageChanged")) {
            const { onPageChanged } = newProps;

            if (onPageChanged) {
                this.signalStore.set(this, this.container, "notify::visible-child-name", (self: StackWidget) => {
                    onPageChanged(self.getVisibleChildName(), self);
                });
            } else {
                this.signalStore.set(this, this.container, "notify::visible-child-name", null);
            }
        }
    }
}

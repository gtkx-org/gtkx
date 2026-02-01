import type { AdwViewStackProps, GtkStackProps } from "../jsx.js";
import type { StackWidget } from "../registry.js";
import { filterProps, hasChanged } from "./internal/props.js";
import { WidgetNode } from "./widget.js";

const OWN_PROPS = ["page", "onPageChanged"] as const;

type StackProps = Omit<Pick<GtkStackProps | AdwViewStackProps, (typeof OWN_PROPS)[number]>, "onPageChanged"> & {
    onPageChanged?: ((page: string | null, self: StackWidget) => void) | null;
};

export class StackNode extends WidgetNode<StackWidget, StackProps> {
    public override commitUpdate(oldProps: StackProps | null, newProps: StackProps): void {
        super.commitUpdate(oldProps ? filterProps(oldProps, OWN_PROPS) : null, filterProps(newProps, OWN_PROPS));
        this.applyOwnProps(oldProps, newProps);
    }

    private applyOwnProps(oldProps: StackProps | null, newProps: StackProps): void {
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
                this.signalStore.set(this, this.container, "notify::visible-child-name", undefined);
            }
        }
    }
}

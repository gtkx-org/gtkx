import type * as Adw from "@gtkx/ffi/adw";
import type * as Gtk from "@gtkx/ffi/gtk";
import type { AdwViewStackProps, GtkStackProps } from "../jsx.js";
import { imperative, type PropDescriptorTable, signal } from "./internal/apply-props.js";
import { WidgetNode } from "./widget.js";

/** Widgets the {@link StackNode} reconciler node specializes. */
export type StackWidget = Gtk.Stack | Adw.ViewStack;

type StackProps = Omit<Pick<GtkStackProps | AdwViewStackProps, "page" | "onPageChanged">, "onPageChanged"> & {
    onPageChanged?: ((page: string | null) => void) | null;
};

export class StackNode extends WidgetNode<StackWidget, StackProps> {
    protected override ownPropDescriptors(): PropDescriptorTable {
        return {
            ...super.ownPropDescriptors(),
            page: imperative(
                () => {
                    const { page } = this.props;
                    if (page && this.container.getVisibleChildName() !== page && this.container.getChildByName(page)) {
                        this.container.setVisibleChildName(page);
                    }
                },
                { always: true },
            ),
            onPageChanged: signal("notify::visible-child-name", {
                getArgs: () => [this.container.getVisibleChildName()],
            }),
        };
    }
}

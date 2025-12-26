import * as Adw from "@gtkx/ffi/adw";
import * as Gtk from "@gtkx/ffi/gtk";
import { registerNodeClass } from "../registry.js";
import { scheduleAfterCommit } from "../scheduler.js";
import type { Container, ContainerClass } from "../types.js";
import { filterProps, isContainerType } from "./internal/utils.js";
import { WidgetNode } from "./widget.js";

const PROPS = ["visibleChildName"];

type StackProps = {
    visibleChildName?: string;
};

class StackNode extends WidgetNode<Gtk.Stack | Adw.ViewStack, StackProps> {
    public static override priority = 1;

    public static override matches(_type: string, containerOrClass?: Container | ContainerClass): boolean {
        return isContainerType(Gtk.Stack, containerOrClass) || isContainerType(Adw.ViewStack, containerOrClass);
    }

    public override updateProps(oldProps: StackProps | null, newProps: StackProps): void {
        if (newProps.visibleChildName && this.container.getVisibleChildName() !== newProps.visibleChildName) {
            const visibleChildName = newProps.visibleChildName;

            scheduleAfterCommit(() => {
                if (this.container.getChildByName(visibleChildName)) {
                    this.container.setVisibleChildName(visibleChildName);
                }
            });
        }

        super.updateProps(filterProps(oldProps ?? {}, PROPS), filterProps(newProps, PROPS));
    }
}

registerNodeClass(StackNode);

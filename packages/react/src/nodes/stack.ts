import * as Adw from "@gtkx/ffi/adw";
import * as Gtk from "@gtkx/ffi/gtk";
import type { Node } from "../node.js";
import { registerNodeClass } from "../registry.js";
import type { Container, ContainerClass } from "../types.js";
import { filterProps, isContainerType } from "./internal/helpers.js";
import { StackPageNode } from "./stack-page.js";
import { WidgetNode } from "./widget.js";

const PROPS = ["visibleChildName"];

type StackProps = {
    visibleChildName?: string;
};

export class StackNode extends WidgetNode<Gtk.Stack | Adw.ViewStack, StackProps> {
    public static override priority = 1;

    public static override matches(_type: string, containerOrClass?: Container | ContainerClass): boolean {
        return isContainerType(Gtk.Stack, containerOrClass) || isContainerType(Adw.ViewStack, containerOrClass);
    }

    public override appendChild(child: Node): void {
        if (!(child instanceof StackPageNode)) {
            throw new Error(`Cannot append child of type ${child.typeName} to PagedStack`);
        }

        child.setStack(this.container);
    }

    public override insertBefore(child: Node): void {
        this.appendChild(child);
    }

    public override removeChild(child: Node): void {
        if (!(child instanceof StackPageNode)) {
            throw new Error(`Cannot remove child of type ${child.typeName} from PagedStack`);
        }

        child.setStack(undefined);
    }

    public override updateProps(oldProps: StackProps | null, newProps: StackProps): void {
        if (newProps.visibleChildName) {
            if (!oldProps || oldProps.visibleChildName !== newProps.visibleChildName) {
                this.container.setVisibleChildName(newProps.visibleChildName);
            } else {
                const firstPage = this.container.getPages().getObject(0) as Gtk.StackPage | Adw.ViewStackPage | null;

                if (firstPage) {
                    this.container.setVisibleChild(firstPage.getChild());
                }
            }
        }

        super.updateProps(filterProps(oldProps ?? {}, PROPS), filterProps(newProps, PROPS));
    }
}

registerNodeClass(StackNode);

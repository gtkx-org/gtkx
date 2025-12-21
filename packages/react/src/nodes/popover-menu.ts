import * as Gtk from "@gtkx/ffi/gtk";
import type { Node } from "../node.js";
import { registerNodeClass } from "../registry.js";
import type { Container, Props } from "../types.js";
import { isContainerType } from "./internal/helpers.js";
import { MenuNode } from "./menu.js";
import { Menu } from "./models/menu.js";
import { WidgetNode } from "./widget.js";

export class PopoverMenuNode extends WidgetNode<Gtk.PopoverMenu | Gtk.PopoverMenuBar> {
    public static override priority = 1;

    private menu: Menu;

    public static override matches(_type: string, containerOrClass?: Container): boolean {
        return (
            isContainerType(Gtk.PopoverMenu, containerOrClass) || isContainerType(Gtk.PopoverMenuBar, containerOrClass)
        );
    }

    constructor(
        typeName: string,
        props: Props,
        container: Gtk.PopoverMenu | Gtk.PopoverMenuBar,
        rootContainer?: Container,
    ) {
        super(typeName, props, container, rootContainer);
        this.menu = new Menu("root", rootContainer instanceof Gtk.Application ? rootContainer : undefined);
        this.container.setMenuModel(this.menu.getMenu());
    }

    public override appendChild(child: Node): void {
        if (!(child instanceof MenuNode)) {
            throw new Error(`Cannot append child of type ${child.typeName} to PopoverMenu`);
        }

        this.menu.appendChild(child);
    }

    public override insertBefore(child: Node, before: Node): void {
        if (!(child instanceof MenuNode)) {
            throw new Error(`Cannot insert child of type ${child.typeName} in PopoverMenu`);
        }

        this.menu.insertBefore(child, before);
    }

    public override removeChild(child: Node): void {
        if (!(child instanceof MenuNode)) {
            throw new Error(`Cannot remove child of type ${child.typeName} from PopoverMenu`);
        }

        this.menu.removeChild(child);
    }
}

registerNodeClass(PopoverMenuNode);

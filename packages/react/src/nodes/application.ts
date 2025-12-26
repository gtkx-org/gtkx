import * as Gtk from "@gtkx/ffi/gtk";
import { Node } from "../node.js";
import { registerNodeClass } from "../registry.js";
import type { Container, ContainerClass, Props } from "../types.js";
import { isContainerType } from "./internal/utils.js";
import { MenuNode } from "./menu.js";
import { Menu } from "./models/menu.js";

class ApplicationNode extends Node<Gtk.Application> {
    static override priority = 0;

    private menu: Menu;

    public static override matches(_type: string, containerOrClass?: Container | ContainerClass) {
        return isContainerType(Gtk.Application, containerOrClass);
    }

    constructor(typeName: string, props: Props, container: Gtk.Application, rootContainer?: Container) {
        super(typeName, props, container, rootContainer);
        const application = rootContainer instanceof Gtk.Application ? rootContainer : undefined;
        this.menu = new Menu("root", {}, container, application);
    }

    public override appendChild(child: Node): void {
        if (child instanceof MenuNode) {
            this.menu.appendChild(child);
            this.container.setMenubar(this.menu.getMenu());
        }
    }

    public override insertBefore(child: Node, before: Node): void {
        if (child instanceof MenuNode) {
            this.menu.insertBefore(child, before);
        }
    }

    public override removeChild(child: Node): void {
        if (child instanceof MenuNode) {
            this.menu.removeChild(child);

            if (child.getMenu().getNItems() === 0) {
                this.container.setMenubar(undefined);
            }
        }
    }
}

registerNodeClass(ApplicationNode);

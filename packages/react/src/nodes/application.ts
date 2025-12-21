import * as Gtk from "@gtkx/ffi/gtk";
import { Node } from "../node.js";
import { registerNodeClass } from "../registry.js";
import type { Container, ContainerClass } from "../types.js";
import { isContainerType } from "./internal/helpers.js";
import { MenuNode } from "./menu.js";
import { Menu } from "./models/menu.js";

export class ApplicationNode extends Node<Gtk.Application> {
    static override priority = 0;

    private menu: Menu;

    public static override matches(_type: string, containerOrClass?: Container | ContainerClass) {
        return isContainerType(Gtk.Application, containerOrClass);
    }

    constructor(typeName: string, props: Record<string, never>, container: Gtk.Application, rootContainer?: Container) {
        super(typeName, props, container, rootContainer);
        this.menu = new Menu("root", container);
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

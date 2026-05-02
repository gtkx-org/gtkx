import * as Gtk from "@gtkx/ffi/gtk";
import { Node } from "../node.js";
import type { Container, Props } from "../types.js";
import { MenuNode } from "./menu.js";
import { MenuModel } from "./models/menu.js";
import { WindowNode } from "./window.js";

export class ApplicationNode extends Node<Gtk.Application, Props, Node, Node> {
    private readonly menu: MenuModel;

    constructor(typeName: string, props: Props, container: Gtk.Application, rootContainer: Container) {
        super(typeName, props, container, rootContainer);
        const application = rootContainer instanceof Gtk.Application ? rootContainer : undefined;
        this.menu = new MenuModel("root", {}, rootContainer, container, application);
    }

    public override isValidChild(): boolean {
        return true;
    }

    public override appendChild(child: Node): void {
        if (child instanceof MenuNode) {
            this.menu.appendChild(child);
            this.container.setMenubar(this.menu.getMenu());
            return;
        }

        super.appendChild(child);
    }

    public override insertBefore(child: Node, before: Node): void {
        if (child instanceof MenuNode) {
            if (before instanceof MenuNode) {
                this.menu.insertBefore(child, before);
            } else {
                this.menu.appendChild(child);
            }
            this.container.setMenubar(this.menu.getMenu());
            return;
        }

        super.insertBefore(child, before);
    }

    public override removeChild(child: Node): void {
        if (child instanceof MenuNode) {
            this.menu.removeChild(child);

            if (this.menu.getMenu().getNItems() === 0) {
                this.container.setMenubar(null);
            }
            return;
        }

        if (child instanceof WindowNode) {
            child.container.setVisible(false);
        }

        super.removeChild(child);
    }
}

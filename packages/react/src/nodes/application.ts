import * as Gtk from "@gtkx/ffi/gtk";
import { Node } from "../node.js";
import type { Container, Props } from "../types.js";
import { MenuChildController } from "./internal/menu-child.js";
import { MenuModel } from "./models/menu.js";
import { WindowNode } from "./window.js";

export class ApplicationNode extends Node<Gtk.Application, Props, Node, Node> {
    private readonly menuController: MenuChildController;

    constructor(typeName: string, props: Props, container: Gtk.Application, rootContainer: Container) {
        super(typeName, props, container, rootContainer);
        const application = rootContainer instanceof Gtk.Application ? rootContainer : undefined;
        this.menuController = new MenuChildController(
            new MenuModel({ type: "root", props: {}, rootContainer, actionMap: container, application }),
        );
    }

    public override isValidChild(): boolean {
        return true;
    }

    public override appendChild(child: Node): void {
        if (this.menuController.appendChild(child)) {
            this.syncMenubar();
            return;
        }

        super.appendChild(child);
    }

    public override insertBefore(child: Node, before: Node): void {
        if (this.menuController.insertBefore(child, before)) {
            this.syncMenubar();
            return;
        }

        super.insertBefore(child, before);
    }

    public override removeChild(child: Node): void {
        if (this.menuController.removeChild(child)) {
            this.syncMenubar();
            return;
        }

        if (child instanceof WindowNode) {
            child.container.setVisible(false);
        }

        super.removeChild(child);
    }

    private syncMenubar(): void {
        const menu = this.menuController.menu.getMenu();
        this.container.setMenubar(menu.getNItems() > 0 ? menu : null);
    }
}

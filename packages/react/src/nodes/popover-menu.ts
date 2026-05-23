import * as Gio from "@gtkx/ffi/gio";
import * as Gtk from "@gtkx/ffi/gtk";
import type { Node } from "../node.js";
import type { Container, Props } from "../types.js";
import { ContainerSlotNode } from "./container-slot.js";
import { EventControllerNode } from "./event-controller.js";
import { MenuChildController } from "./internal/menu-child.js";
import { MenuNode } from "./menu.js";
import { MenuModel } from "./models/menu.js";
import { SlotNode } from "./slot.js";
import { WidgetNode } from "./widget.js";

/** Widgets the {@link PopoverMenuNode} reconciler node specializes. */
export type PopoverMenuWidget = Gtk.PopoverMenu | Gtk.PopoverMenuBar | Gtk.MenuButton;

type PopoverMenuChild = MenuNode | SlotNode | ContainerSlotNode | EventControllerNode | WidgetNode;

export class PopoverMenuNode extends WidgetNode<PopoverMenuWidget, Props, PopoverMenuChild> {
    private readonly menuController: MenuChildController;

    public override isValidChild(child: Node): boolean {
        return (
            child instanceof MenuNode ||
            child instanceof SlotNode ||
            child instanceof EventControllerNode ||
            child instanceof ContainerSlotNode ||
            child instanceof WidgetNode
        );
    }

    constructor(typeName: string, props: Props, container: PopoverMenuWidget, rootContainer: Container) {
        super(typeName, props, container, rootContainer);

        const application = rootContainer instanceof Gtk.Application ? rootContainer : undefined;
        const actionGroup = new Gio.SimpleActionGroup();
        const prefix = application ? "app" : "menu";

        this.container.insertActionGroup(prefix, actionGroup);
        const menu = new MenuModel({ type: "root", props: {}, rootContainer, actionMap: actionGroup, application });
        this.menuController = new MenuChildController(menu);
        this.container.setMenuModel(menu.getMenu());
    }

    public override appendChild(child: PopoverMenuChild): void {
        if (this.menuController.appendChild(child)) return;
        super.appendChild(child);
    }

    public override insertBefore(child: PopoverMenuChild, before: PopoverMenuChild): void {
        if (this.menuController.insertBefore(child, before)) return;
        super.insertBefore(child, before);
    }

    public override removeChild(child: PopoverMenuChild): void {
        if (this.menuController.removeChild(child)) return;
        super.removeChild(child);
    }
}

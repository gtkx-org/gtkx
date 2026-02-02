import * as Gio from "@gtkx/ffi/gio";
import * as Gtk from "@gtkx/ffi/gtk";
import type { Node } from "../node.js";
import type { PopoverMenuWidget } from "../registry.js";
import type { Container, Props } from "../types.js";
import { MenuNode } from "./menu.js";
import { MenuModel } from "./models/menu.js";
import { SlotNode } from "./slot.js";
import { WidgetNode } from "./widget.js";

type PopoverMenuChild = MenuNode | SlotNode | WidgetNode;

export class PopoverMenuNode extends WidgetNode<PopoverMenuWidget, Props, PopoverMenuChild> {
    private menu: MenuModel;

    public override isValidChild(child: Node): boolean {
        return child instanceof MenuNode || child instanceof SlotNode || child instanceof WidgetNode;
    }

    constructor(typeName: string, props: Props, container: PopoverMenuWidget, rootContainer: Container) {
        super(typeName, props, container, rootContainer);

        const application = rootContainer instanceof Gtk.Application ? rootContainer : undefined;
        const actionGroup = new Gio.SimpleActionGroup();
        const prefix = application ? "app" : "menu";

        this.container.insertActionGroup(prefix, actionGroup);
        this.menu = new MenuModel("root", {}, rootContainer, actionGroup, application);
        this.container.setMenuModel(this.menu.getMenu());
    }

    public override appendChild(child: PopoverMenuChild): void {
        if (child instanceof MenuNode) {
            this.menu.appendChild(child);
            return;
        }
        super.appendChild(child);
    }

    public override insertBefore(child: PopoverMenuChild, before: PopoverMenuChild): void {
        if (child instanceof MenuNode) {
            if (before instanceof MenuNode) {
                this.menu.insertBefore(child, before);
            } else {
                this.menu.appendChild(child);
            }
            return;
        }
        super.insertBefore(child, before);
    }

    public override removeChild(child: PopoverMenuChild): void {
        if (child instanceof MenuNode) {
            this.menu.removeChild(child);
            return;
        }
        super.removeChild(child);
    }
}

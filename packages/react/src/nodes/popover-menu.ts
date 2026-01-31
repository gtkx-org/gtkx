import * as Gio from "@gtkx/ffi/gio";
import * as Gtk from "@gtkx/ffi/gtk";
import type { Container, Props } from "../types.js";
import { MenuNode } from "./menu.js";
import { MenuModel } from "./models/menu.js";
import type { SlotNode } from "./slot.js";
import { WidgetNode } from "./widget.js";

const ACTION_PREFIX = "menu";

type PopoverMenuChild = MenuNode | SlotNode | WidgetNode;

export class PopoverMenuNode extends WidgetNode<
    Gtk.PopoverMenu | Gtk.PopoverMenuBar | Gtk.MenuButton,
    Props,
    PopoverMenuChild
> {
    private menu: MenuModel;

    constructor(
        typeName: string,
        props: Props,
        container: Gtk.PopoverMenu | Gtk.PopoverMenuBar | Gtk.MenuButton,
        rootContainer: Container,
    ) {
        super(typeName, props, container, rootContainer);

        const application = rootContainer instanceof Gtk.Application ? rootContainer : undefined;
        const actionGroup = new Gio.SimpleActionGroup();
        const prefix = application ? "app" : ACTION_PREFIX;

        this.container.insertActionGroup(prefix, actionGroup);
        this.menu = new MenuModel("root", {}, rootContainer, actionGroup, application);
        this.container.setMenuModel(this.menu.getMenu());
    }

    public override appendChild(child: PopoverMenuChild): void {
        if (child instanceof MenuNode) {
            this.menu.appendChild(child);
        }
        super.appendChild(child);
    }

    public override insertBefore(child: PopoverMenuChild, before: PopoverMenuChild): void {
        if (child instanceof MenuNode && before instanceof MenuNode) {
            this.menu.insertBefore(child, before);
        }
        super.insertBefore(child, before);
    }

    public override removeChild(child: PopoverMenuChild): void {
        if (child instanceof MenuNode) {
            this.menu.removeChild(child);
        }
        super.removeChild(child);
    }
}

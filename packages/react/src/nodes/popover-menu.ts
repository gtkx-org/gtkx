import * as Gio from "@gtkx/ffi/gio";
import * as Gtk from "@gtkx/ffi/gtk";
import type { Node } from "../node.js";
import type { Container, Props } from "../types.js";
import { MenuNode } from "./menu.js";
import { MenuModel } from "./models/menu.js";
import { SlotNode } from "./slot.js";
import { WidgetNode } from "./widget.js";

const ACTION_PREFIX = "menu";

export class PopoverMenuNode extends WidgetNode<Gtk.PopoverMenu | Gtk.PopoverMenuBar | Gtk.MenuButton> {
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

    public override appendChild(child: Node): void {
        if (child instanceof MenuNode) {
            super.appendChild(child);
            this.menu.appendChild(child);
            return;
        }

        if (child instanceof SlotNode || child instanceof WidgetNode) {
            super.appendChild(child);
            return;
        }

        throw new Error(`Cannot append '${child.typeName}' to 'PopoverMenu': expected MenuItem or Widget`);
    }

    public override insertBefore(child: Node, before: Node): void {
        if (child instanceof MenuNode) {
            super.insertBefore(child, before);
            this.menu.insertBefore(child, before);
            return;
        }

        if (child instanceof SlotNode || child instanceof WidgetNode) {
            super.insertBefore(child, before);
            return;
        }

        throw new Error(`Cannot insert '${child.typeName}' into 'PopoverMenu': expected MenuItem or Widget`);
    }

    public override removeChild(child: Node): void {
        if (child instanceof MenuNode) {
            this.menu.removeChild(child);
            super.removeChild(child);
            return;
        }

        if (child instanceof SlotNode || child instanceof WidgetNode) {
            super.removeChild(child);
            return;
        }

        throw new Error(`Cannot remove '${child.typeName}' from 'PopoverMenu': expected MenuItem or Widget`);
    }
}

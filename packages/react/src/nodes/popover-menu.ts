import * as Gio from "@gtkx/ffi/gio";
import * as Gtk from "@gtkx/ffi/gtk";
import { POPOVER_MENU_CLASSES } from "../generated/internal.js";
import type { Node } from "../node.js";
import { registerNodeClass } from "../registry.js";
import type { Container, ContainerClass, Props } from "../types.js";
import { matchesAnyClass } from "./internal/utils.js";
import { MenuNode } from "./menu.js";
import { Menu } from "./models/menu.js";
import { SlotNode } from "./slot.js";
import { WidgetNode } from "./widget.js";

const ACTION_PREFIX = "menu";

class PopoverMenuNode extends WidgetNode<Gtk.PopoverMenu | Gtk.PopoverMenuBar | Gtk.MenuButton> {
    public static override priority = 1;

    private menu: Menu;

    public static override matches(_type: string, containerOrClass?: Container | ContainerClass | null): boolean {
        return matchesAnyClass(POPOVER_MENU_CLASSES, containerOrClass);
    }

    constructor(
        typeName: string,
        props: Props,
        container: Gtk.PopoverMenu | Gtk.PopoverMenuBar | Gtk.MenuButton,
        rootContainer?: Container,
    ) {
        super(typeName, props, container, rootContainer);

        const application = rootContainer instanceof Gtk.Application ? rootContainer : undefined;
        const actionGroup = new Gio.SimpleActionGroup();
        const prefix = application ? "app" : ACTION_PREFIX;

        this.container.insertActionGroup(prefix, actionGroup);
        this.menu = new Menu("root", {}, actionGroup, application);
        this.container.setMenuModel(this.menu.getMenu());
    }

    public override appendChild(child: Node): void {
        if (child instanceof SlotNode || child instanceof WidgetNode) {
            super.appendChild(child);
            return;
        }

        if (!(child instanceof MenuNode)) {
            throw new Error(`Cannot append '${child.typeName}' to 'PopoverMenu': expected MenuItem`);
        }

        this.menu.appendChild(child);
    }

    public override insertBefore(child: Node, before: Node): void {
        if (child instanceof SlotNode || child instanceof WidgetNode) {
            super.insertBefore(child, before);
            return;
        }

        if (!(child instanceof MenuNode)) {
            throw new Error(`Cannot insert '${child.typeName}' to 'PopoverMenu': expected MenuItem`);
        }

        this.menu.insertBefore(child, before);
    }

    public override removeChild(child: Node): void {
        if (child instanceof SlotNode || child instanceof WidgetNode) {
            super.removeChild(child);
            return;
        }

        if (!(child instanceof MenuNode)) {
            throw new Error(`Cannot remove '${child.typeName}' from 'PopoverMenu': expected MenuItem`);
        }

        this.menu.removeChild(child);
    }
}

registerNodeClass(PopoverMenuNode);

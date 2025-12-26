import * as Gtk from "@gtkx/ffi/gtk";
import { registerNodeClass } from "../registry.js";
import type { Container } from "../types.js";
import { Menu, type MenuProps, type MenuType } from "./models/menu.js";

export class MenuNode extends Menu {
    public static override priority = 1;

    public static override matches(type: string): boolean {
        return type === "Menu.Item" || type === "Menu.Section" || type === "Menu.Submenu";
    }

    private static getType(typeName: string): MenuType {
        if (typeName === "Menu.Item") {
            return "item";
        } else if (typeName === "Menu.Section") {
            return "section";
        } else if (typeName === "Menu.Submenu") {
            return "submenu";
        }

        throw new Error(`Unable to find menu type '${typeName}'`);
    }

    constructor(typeName: string, props: MenuProps, _container: undefined, rootContainer?: Container) {
        super(
            MenuNode.getType(typeName),
            props,
            undefined,
            rootContainer instanceof Gtk.Application ? rootContainer : undefined,
        );
    }
}

registerNodeClass(MenuNode);

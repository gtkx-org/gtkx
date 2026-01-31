import * as Gtk from "@gtkx/ffi/gtk";
import type { Container } from "../types.js";
import { MenuModel, type MenuProps, type MenuType } from "./models/menu.js";

export class MenuNode extends MenuModel {
    private static getType(typeName: string): MenuType {
        if (typeName === "MenuItem") {
            return "item";
        } else if (typeName === "MenuSection") {
            return "section";
        } else if (typeName === "MenuSubmenu") {
            return "submenu";
        }

        throw new Error(`Unable to find menu type '${typeName}'`);
    }

    constructor(typeName: string, props: MenuProps, _container: undefined, rootContainer: Container) {
        super(
            MenuNode.getType(typeName),
            props,
            rootContainer,
            undefined,
            rootContainer instanceof Gtk.Application ? rootContainer : undefined,
        );
    }
}

import * as Gtk from "@gtkx/gi/gtk";
import type { BackingInstance } from "../types.js";
import { MenuModel, type MenuModelProps, type MenuType } from "./models/menu.js";

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

    constructor(typeName: string, props: MenuModelProps, _container: undefined, rootContainer: BackingInstance) {
        super({
            type: MenuNode.getType(typeName),
            props,
            rootContainer,
            application: rootContainer instanceof Gtk.Application ? rootContainer : undefined,
        });
    }
}

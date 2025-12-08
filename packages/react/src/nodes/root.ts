import type * as Gtk from "@gtkx/ffi/gtk";
import { Node } from "../node.js";

export const ROOT_NODE_CONTAINER = Symbol.for("ROOT_NODE_CONTAINER");

export class RootNode extends Node<never> {
    static matches(_type: string, existingWidget?: Gtk.Widget | typeof ROOT_NODE_CONTAINER): boolean {
        return existingWidget === ROOT_NODE_CONTAINER;
    }

    protected override isVirtual(): boolean {
        return true;
    }

    constructor() {
        super("", {});
    }
}

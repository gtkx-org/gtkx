import * as Adw from "@gtkx/ffi/adw";
import * as Gtk from "@gtkx/ffi/gtk";
import type { Node } from "../node.js";
import { registerNodeClass } from "../registry.js";
import type { Container, ContainerClass } from "../types.js";
import { isContainerType } from "./internal/helpers.js";
import { SimpleListStore } from "./internal/simple-list-store.js";
import { SimpleListItemNode } from "./simple-list-item.js";
import { WidgetNode } from "./widget.js";

export class SimpleListViewNode extends WidgetNode<Gtk.DropDown | Adw.ComboRow> {
    public static override priority = 1;

    public static override matches(_type: string, containerOrClass?: Container | ContainerClass): boolean {
        return isContainerType(Gtk.DropDown, containerOrClass) || isContainerType(Adw.ComboRow, containerOrClass);
    }

    private store = new SimpleListStore();

    public override appendChild(child: Node): void {
        if (!(child instanceof SimpleListItemNode)) {
            throw new Error(`Cannot append child of type ${child.typeName} to SimpleListView`);
        }

        const { id, value } = child.props;
        if (!id || value === undefined) {
            throw new Error("SimpleListItem requires id and value props");
        }

        child.setStore(this.store);
        this.store.addItem(id, value);
    }

    public override insertBefore(child: Node, before: Node): void {
        if (!(child instanceof SimpleListItemNode) || !(before instanceof SimpleListItemNode)) {
            throw new Error(`Cannot insert child of type ${child.typeName} in SimpleListView`);
        }

        const { id, value } = child.props;
        const beforeId = before.props.id;
        if (!id || value === undefined || !beforeId) {
            throw new Error("SimpleListItem requires id and value props");
        }

        child.setStore(this.store);
        this.store.insertItemBefore(id, value, beforeId);
    }

    public override removeChild(child: Node): void {
        if (!(child instanceof SimpleListItemNode)) {
            throw new Error(`Cannot remove child of type ${child.typeName} from SimpleListView`);
        }

        const { id } = child.props;
        if (!id) {
            throw new Error("SimpleListItem requires id prop");
        }

        this.store.removeItem(id);
    }
}

registerNodeClass(SimpleListViewNode);

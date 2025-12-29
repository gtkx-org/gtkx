import * as Gtk from "@gtkx/ffi/gtk";
import type { Node } from "../node.js";
import { registerNodeClass } from "../registry.js";
import type { Container, ContainerClass } from "../types.js";
import { ListItemRenderer, type RenderItemFn } from "./internal/list-item-renderer.js";
import { filterProps, isContainerType } from "./internal/utils.js";
import { ListItemNode } from "./list-item.js";
import { List } from "./models/list.js";
import { WidgetNode } from "./widget.js";

const PROP_NAMES = ["renderItem"];

type ListViewProps = {
    renderItem?: RenderItemFn<unknown>;
};

class ListViewNode extends WidgetNode<Gtk.ListView | Gtk.GridView, ListViewProps> {
    public static override priority = 1;

    private itemRenderer: ListItemRenderer;
    private list: List;

    public static override matches(_type: string, containerOrClass?: Container | ContainerClass): boolean {
        return isContainerType(Gtk.ListView, containerOrClass) || isContainerType(Gtk.GridView, containerOrClass);
    }

    constructor(
        typeName: string,
        props: ListViewProps,
        container: Gtk.ListView | Gtk.GridView,
        rootContainer?: Container,
    ) {
        super(typeName, props, container, rootContainer);
        this.list = new List();
        this.itemRenderer = new ListItemRenderer();
        this.itemRenderer.setStore(this.list.getStore());
        this.container.setFactory(this.itemRenderer.getFactory());
    }

    public override mount(): void {
        super.mount();
        this.container.setModel(this.list.getSelectionModel());
    }

    public override appendChild(child: Node): void {
        if (!(child instanceof ListItemNode)) {
            throw new Error(`Cannot append '${child.typeName}' to 'ListView': expected ListItem`);
        }

        this.list.appendChild(child);
    }

    public override insertBefore(child: Node, before: Node): void {
        if (!(child instanceof ListItemNode) || !(before instanceof ListItemNode)) {
            throw new Error(`Cannot insert '${child.typeName}' to 'ListView': expected ListItem`);
        }

        this.list.insertBefore(child, before);
    }

    public override removeChild(child: Node): void {
        if (!(child instanceof ListItemNode)) {
            throw new Error(`Cannot remove '${child.typeName}' from 'ListView': expected ListItem`);
        }

        this.list.removeChild(child);
    }

    public override updateProps(oldProps: ListViewProps | null, newProps: ListViewProps): void {
        if (!oldProps || oldProps.renderItem !== newProps.renderItem) {
            this.itemRenderer.setRenderFn(newProps.renderItem);
        }

        this.list.updateProps(filterProps(oldProps ?? {}, PROP_NAMES), filterProps(newProps, PROP_NAMES));
        super.updateProps(filterProps(oldProps ?? {}, PROP_NAMES), filterProps(newProps, PROP_NAMES));
    }
}

registerNodeClass(ListViewNode);

import * as Gtk from "@gtkx/ffi/gtk";
import type { Node } from "../node.js";
import { registerNodeClass } from "../registry.js";
import type { Container } from "../types.js";
import { TreeListItemRenderer, type TreeRenderItemFn } from "./internal/tree-list-item-renderer.js";
import { filterProps } from "./internal/utils.js";
import { TreeList, type TreeListProps } from "./models/tree-list.js";
import { TreeListItemNode } from "./tree-list-item.js";
import { WidgetNode } from "./widget.js";

const PROP_NAMES = ["renderItem", "autoexpand", "selectionMode", "selected", "onSelectionChanged"];

type TreeListViewProps = TreeListProps & {
    renderItem?: TreeRenderItemFn<unknown>;
};

class TreeListViewNode extends WidgetNode<Gtk.ListView, TreeListViewProps> {
    public static override priority = 1;

    private itemRenderer: TreeListItemRenderer;
    private treeList: TreeList;

    public static override matches(type: string): boolean {
        return type === "TreeListView";
    }

    public static override createContainer(): Gtk.ListView {
        return new Gtk.ListView();
    }

    constructor(
        typeName: string,
        props: TreeListViewProps,
        container: Gtk.ListView | undefined,
        rootContainer?: Container,
    ) {
        const listView = container ?? new Gtk.ListView();
        super(typeName, props, listView, rootContainer);
        this.treeList = new TreeList(props.autoexpand, props.selectionMode);
        this.itemRenderer = new TreeListItemRenderer();
        this.itemRenderer.setStore(this.treeList.getStore());
        this.container.setFactory(this.itemRenderer.getFactory());
    }

    public override mount(): void {
        super.mount();
        this.container.setModel(this.treeList.getSelectionModel());
    }

    public override appendChild(child: Node): void {
        if (!(child instanceof TreeListItemNode)) {
            throw new Error(`Cannot append '${child.typeName}' to 'TreeListView': expected TreeListItem`);
        }

        this.treeList.appendChild(child);
    }

    public override insertBefore(child: Node, before: Node): void {
        if (!(child instanceof TreeListItemNode) || !(before instanceof TreeListItemNode)) {
            throw new Error(`Cannot insert '${child.typeName}' to 'TreeListView': expected TreeListItem`);
        }

        this.treeList.insertBefore(child, before);
    }

    public override removeChild(child: Node): void {
        if (!(child instanceof TreeListItemNode)) {
            throw new Error(`Cannot remove '${child.typeName}' from 'TreeListView': expected TreeListItem`);
        }

        this.treeList.removeChild(child);
    }

    public override updateProps(oldProps: TreeListViewProps | null, newProps: TreeListViewProps): void {
        if (!oldProps || oldProps.renderItem !== newProps.renderItem) {
            this.itemRenderer.setRenderFn(newProps.renderItem);
        }

        this.treeList.updateProps(filterProps(oldProps ?? {}, ["renderItem"]), filterProps(newProps, ["renderItem"]));
        super.updateProps(filterProps(oldProps ?? {}, PROP_NAMES), filterProps(newProps, PROP_NAMES));
    }
}

registerNodeClass(TreeListViewNode);

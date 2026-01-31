import * as Gtk from "@gtkx/ffi/gtk";
import type { Node } from "../node.js";
import type { Container } from "../types.js";
import { TreeListItemRenderer, type TreeRenderItemFn } from "./internal/tree-list-item-renderer.js";
import { filterProps } from "./internal/utils.js";
import { TreeList, type TreeListProps } from "./models/tree-list.js";
import { TreeListItemNode } from "./tree-list-item.js";
import { WidgetNode } from "./widget.js";

const RENDERER_PROP_NAMES = ["renderItem", "estimatedItemHeight"] as const;
const PROP_NAMES = [...RENDERER_PROP_NAMES, "autoexpand", "selectionMode", "selected", "onSelectionChanged"] as const;

type TreeListViewProps = TreeListProps & {
    renderItem?: TreeRenderItemFn<unknown>;
    estimatedItemHeight?: number;
};

export class TreeListViewNode extends WidgetNode<Gtk.ListView, TreeListViewProps> {
    private itemRenderer: TreeListItemRenderer;
    private treeList: TreeList;

    public static override createContainer(): Gtk.ListView {
        return new Gtk.ListView();
    }

    constructor(
        typeName: string,
        props: TreeListViewProps,
        container: Gtk.ListView | undefined,
        rootContainer: Container,
    ) {
        const listView = container ?? new Gtk.ListView();
        super(typeName, props, listView, rootContainer);
        this.treeList = new TreeList(
            {
                autoexpand: props.autoexpand,
                selectionMode: props.selectionMode,
                selected: props.selected,
                onSelectionChanged: props.onSelectionChanged,
            },
            rootContainer,
        );
        this.itemRenderer = new TreeListItemRenderer(this.signalStore);
        this.itemRenderer.setStore(this.treeList.getStore());
        this.treeList.getStore().setOnItemUpdated((id) => this.itemRenderer.rebindItem(id));
        this.container.setFactory(this.itemRenderer.getFactory());
    }

    public override finalizeInitialChildren(props: TreeListViewProps): boolean {
        super.finalizeInitialChildren(props);
        return true;
    }

    public override commitMount(): void {
        super.commitMount();
        this.container.setModel(this.treeList.getSelectionModel());
    }

    public override detachDeletedInstance(): void {
        this.itemRenderer.dispose();
        super.detachDeletedInstance();
    }

    public override appendChild(child: Node): void {
        if (!(child instanceof TreeListItemNode)) {
            throw new Error(`Cannot append '${child.typeName}' to '${this.typeName}': expected x.TreeListItem`);
        }

        super.appendChild(child);
        this.treeList.appendChild(child);
    }

    public override insertBefore(child: Node, before: Node): void {
        if (!(child instanceof TreeListItemNode) || !(before instanceof TreeListItemNode)) {
            throw new Error(`Cannot insert '${child.typeName}' into '${this.typeName}': expected x.TreeListItem`);
        }

        super.insertBefore(child, before);
        this.treeList.insertBefore(child, before);
    }

    public override removeChild(child: Node): void {
        if (!(child instanceof TreeListItemNode)) {
            throw new Error(`Cannot remove '${child.typeName}' from '${this.typeName}': expected x.TreeListItem`);
        }

        this.treeList.removeChild(child);
        super.removeChild(child);
    }

    protected override applyUpdate(oldProps: TreeListViewProps | null, newProps: TreeListViewProps): void {
        if (!oldProps || oldProps.renderItem !== newProps.renderItem) {
            this.itemRenderer.setRenderFn(newProps.renderItem ?? null);
        }

        if (!oldProps || oldProps.estimatedItemHeight !== newProps.estimatedItemHeight) {
            this.itemRenderer.setEstimatedItemHeight(newProps.estimatedItemHeight ?? null);
        }

        const previousModel = this.treeList.getSelectionModel();
        this.treeList.commitUpdate(
            oldProps ? filterProps(oldProps, RENDERER_PROP_NAMES) : null,
            filterProps(newProps, RENDERER_PROP_NAMES),
        );
        const currentModel = this.treeList.getSelectionModel();

        if (previousModel !== currentModel) {
            this.container.setModel(currentModel);
        }

        super.applyUpdate(oldProps ? filterProps(oldProps, PROP_NAMES) : null, filterProps(newProps, PROP_NAMES));
    }
}

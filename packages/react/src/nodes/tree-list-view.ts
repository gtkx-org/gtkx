import * as Gtk from "@gtkx/ffi/gtk";
import type { GtkListViewProps, TreeListModelProps } from "../jsx.js";
import type { Node } from "../node.js";
import type { Container } from "../types.js";
import { filterProps, hasChanged } from "./internal/props.js";
import { TreeListItemRenderer } from "./internal/tree-list-item-renderer.js";
import { TreeListModel } from "./models/tree-list.js";
import { TreeListItemNode } from "./tree-list-item.js";
import { WidgetNode } from "./widget.js";

const RENDERER_OWN_PROPS = ["renderItem", "estimatedItemHeight"] as const;
const OWN_PROPS = [...RENDERER_OWN_PROPS, "autoexpand", "selectionMode", "selected", "onSelectionChanged"] as const;

type TreeListViewProps = Pick<GtkListViewProps, (typeof RENDERER_OWN_PROPS)[number]> & TreeListModelProps;

export class TreeListViewNode extends WidgetNode<Gtk.ListView, TreeListViewProps, TreeListItemNode> {
    private itemRenderer: TreeListItemRenderer;
    private treeList: TreeListModel;

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
        this.treeList = new TreeListModel(
            { owner: this, signalStore: this.signalStore },
            {
                autoexpand: props.autoexpand,
                selectionMode: props.selectionMode,
                selected: props.selected,
                onSelectionChanged: props.onSelectionChanged,
            },
        );
        this.itemRenderer = new TreeListItemRenderer(this.signalStore);
        this.itemRenderer.setStore(this.treeList.getStore());
        this.treeList.getStore().setOnItemUpdated((id) => this.itemRenderer.rebindItem(id));
        this.container.setFactory(this.itemRenderer.getFactory());
    }

    public override isValidChild(child: Node): boolean {
        return child instanceof TreeListItemNode;
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

    public override appendChild(child: TreeListItemNode): void {
        super.appendChild(child);
        this.treeList.appendChild(child);
    }

    public override insertBefore(child: TreeListItemNode, before: TreeListItemNode): void {
        super.insertBefore(child, before);
        this.treeList.insertBefore(child, before);
    }

    public override removeChild(child: TreeListItemNode): void {
        this.treeList.removeChild(child);
        super.removeChild(child);
    }

    public override commitUpdate(oldProps: TreeListViewProps | null, newProps: TreeListViewProps): void {
        if (hasChanged(oldProps, newProps, "renderItem")) {
            this.itemRenderer.setRenderFn(newProps.renderItem ?? null);
        }

        if (hasChanged(oldProps, newProps, "estimatedItemHeight")) {
            this.itemRenderer.setEstimatedItemHeight(newProps.estimatedItemHeight ?? null);
        }

        const previousModel = this.treeList.getSelectionModel();
        this.treeList.updateProps(
            oldProps ? filterProps(oldProps, RENDERER_OWN_PROPS) : null,
            filterProps(newProps, RENDERER_OWN_PROPS),
        );
        const currentModel = this.treeList.getSelectionModel();

        if (previousModel !== currentModel) {
            this.container.setModel(currentModel);
        }

        super.commitUpdate(oldProps ? filterProps(oldProps, OWN_PROPS) : null, filterProps(newProps, OWN_PROPS));
    }
}

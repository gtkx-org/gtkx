import type { GtkListViewProps, ListModelProps } from "../jsx.js";
import type { ListViewWidget } from "../registry.js";
import type { Container } from "../types.js";
import { ListItemRenderer } from "./internal/list-item-renderer.js";
import { filterProps, hasChanged } from "./internal/props.js";
import type { ListItemNode } from "./list-item.js";
import { ListModel } from "./models/list.js";
import { WidgetNode } from "./widget.js";

const OWN_PROPS = ["renderItem", "estimatedItemHeight"] as const;

type ListViewProps = Pick<GtkListViewProps, (typeof OWN_PROPS)[number]> & ListModelProps;

export class ListViewNode extends WidgetNode<ListViewWidget, ListViewProps, ListItemNode> {
    private itemRenderer: ListItemRenderer;
    private list: ListModel;

    constructor(typeName: string, props: ListViewProps, container: ListViewWidget, rootContainer: Container) {
        super(typeName, props, container, rootContainer);
        this.list = new ListModel(
            { owner: this, signalStore: this.signalStore },
            {
                selectionMode: props.selectionMode,
                selected: props.selected,
                onSelectionChanged: props.onSelectionChanged,
            },
        );
        this.itemRenderer = new ListItemRenderer(this.signalStore);
        this.itemRenderer.setStore(this.list.getStore());
        this.list.getStore().setOnItemUpdated((id) => this.itemRenderer.rebindItem(id));
        this.container.setFactory(this.itemRenderer.getFactory());
    }

    public override finalizeInitialChildren(props: ListViewProps): boolean {
        super.finalizeInitialChildren(props);
        return true;
    }

    public override commitMount(): void {
        super.commitMount();
        this.container.setModel(this.list.getSelectionModel());
    }

    public override detachDeletedInstance(): void {
        this.itemRenderer.dispose();
        super.detachDeletedInstance();
    }

    public override appendChild(child: ListItemNode): void {
        super.appendChild(child);
        this.list.appendChild(child);
    }

    public override insertBefore(child: ListItemNode, before: ListItemNode): void {
        super.insertBefore(child, before);
        this.list.insertBefore(child, before);
    }

    public override removeChild(child: ListItemNode): void {
        this.list.removeChild(child);
        super.removeChild(child);
    }

    public override commitUpdate(oldProps: ListViewProps | null, newProps: ListViewProps): void {
        super.commitUpdate(oldProps ? filterProps(oldProps, OWN_PROPS) : null, filterProps(newProps, OWN_PROPS));
        this.applyOwnProps(oldProps, newProps);
    }

    private applyOwnProps(oldProps: ListViewProps | null, newProps: ListViewProps): void {
        if (hasChanged(oldProps, newProps, "renderItem")) {
            this.itemRenderer.setRenderFn(newProps.renderItem ?? null);
        }

        if (hasChanged(oldProps, newProps, "estimatedItemHeight")) {
            this.itemRenderer.setEstimatedItemHeight(newProps.estimatedItemHeight ?? null);
        }

        const previousModel = this.list.getSelectionModel();
        this.list.updateProps(oldProps, newProps);
        const currentModel = this.list.getSelectionModel();

        if (previousModel !== currentModel) {
            this.container.setModel(currentModel);
        }
    }
}

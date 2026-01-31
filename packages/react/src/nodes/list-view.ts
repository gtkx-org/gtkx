import type * as Gtk from "@gtkx/ffi/gtk";
import type { Container } from "../types.js";
import { ListItemRenderer, type RenderItemFn } from "./internal/list-item-renderer.js";
import { hasChanged } from "./internal/utils.js";
import type { ListItemNode } from "./list-item.js";
import { ListModel, type ListProps } from "./models/list.js";
import { WidgetNode } from "./widget.js";

const OWN_PROPS = ["renderItem", "estimatedItemHeight"] as const;

type ListViewProps = ListProps & {
    renderItem?: RenderItemFn<unknown>;
    estimatedItemHeight?: number;
};

export class ListViewNode extends WidgetNode<Gtk.ListView | Gtk.GridView, ListViewProps, ListItemNode> {
    protected override readonly excludedPropNames = OWN_PROPS;
    private itemRenderer: ListItemRenderer;
    private list: ListModel;

    constructor(
        typeName: string,
        props: ListViewProps,
        container: Gtk.ListView | Gtk.GridView,
        rootContainer: Container,
    ) {
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
        super.commitUpdate(oldProps, newProps);
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

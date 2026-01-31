import { isObjectEqual } from "@gtkx/ffi";
import type * as Gtk from "@gtkx/ffi/gtk";
import type { Node } from "../node.js";
import type { Container } from "../types.js";
import { ListItemRenderer, type RenderItemFn } from "./internal/list-item-renderer.js";
import { filterProps, hasChanged } from "./internal/utils.js";
import { ListItemNode } from "./list-item.js";
import { ListModel, type ListProps } from "./models/list.js";
import { WidgetNode } from "./widget.js";

const OWN_PROPS = ["renderItem", "estimatedItemHeight"] as const;

type ListViewProps = ListProps & {
    renderItem?: RenderItemFn<unknown>;
    estimatedItemHeight?: number;
};

export class ListViewNode extends WidgetNode<Gtk.ListView | Gtk.GridView, ListViewProps> {
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

    public override mount(): void {
        super.mount();
        this.container.setModel(this.list.getSelectionModel());
    }

    public override unmount(): void {
        this.itemRenderer.dispose();
        super.unmount();
    }

    public override appendChild(child: Node): void {
        if (!(child instanceof ListItemNode)) {
            throw new Error(`Cannot append '${child.typeName}' to '${this.typeName}': expected x.ListItem`);
        }

        this.list.appendChild(child);
    }

    public override insertBefore(child: Node, before: Node): void {
        if (!(child instanceof ListItemNode) || !(before instanceof ListItemNode)) {
            throw new Error(`Cannot insert '${child.typeName}' into '${this.typeName}': expected x.ListItem`);
        }

        this.list.insertBefore(child, before);
    }

    public override removeChild(child: Node): void {
        if (!(child instanceof ListItemNode)) {
            throw new Error(`Cannot remove '${child.typeName}' from '${this.typeName}': expected x.ListItem`);
        }

        this.list.removeChild(child);
    }

    public override updateProps(oldProps: ListViewProps | null, newProps: ListViewProps): void {
        super.updateProps(oldProps ? filterProps(oldProps, OWN_PROPS) : null, filterProps(newProps, OWN_PROPS));
        this.applyOwnProps(oldProps, newProps);
    }

    protected applyOwnProps(oldProps: ListViewProps | null, newProps: ListViewProps): void {
        if (hasChanged(oldProps, newProps, "renderItem")) {
            this.itemRenderer.setRenderFn(newProps.renderItem ?? null);
        }

        if (hasChanged(oldProps, newProps, "estimatedItemHeight")) {
            this.itemRenderer.setEstimatedItemHeight(newProps.estimatedItemHeight ?? null);
        }

        const previousModel = this.list.getSelectionModel();
        this.list.updateProps(oldProps, newProps);
        const currentModel = this.list.getSelectionModel();

        if (!isObjectEqual(previousModel, currentModel)) {
            this.container.setModel(currentModel);
        }
    }
}

import type * as Gtk from "@gtkx/ffi/gtk";
import type { GtkGridViewProps } from "../jsx.js";
import type { Node } from "../node.js";
import type { Container } from "../types.js";
import { ContainerSlotNode } from "./container-slot.js";
import { EventControllerNode } from "./event-controller.js";
import { GridItemRenderer } from "./internal/grid-item-renderer.js";
import { filterProps, hasChanged } from "./internal/props.js";
import { ListItemNode } from "./list-item.js";
import { ListSectionNode } from "./list-section.js";
import { ListModel, type ListModelProps } from "./models/list.js";
import { SlotNode } from "./slot.js";
import { WidgetNode } from "./widget.js";

const RENDERER_PROPS = ["renderItem", "estimatedItemHeight"] as const;
const OWN_PROPS = [...RENDERER_PROPS, "selectionMode", "selected", "onSelectionChanged"] as const;

type GridViewProps = Pick<GtkGridViewProps, (typeof RENDERER_PROPS)[number]> & ListModelProps;

type GridViewChild = ListItemNode | ListSectionNode | EventControllerNode | SlotNode | ContainerSlotNode;

export class GridViewNode extends WidgetNode<Gtk.GridView, GridViewProps, GridViewChild> {
    private itemRenderer: GridItemRenderer;
    private list: ListModel;

    constructor(typeName: string, props: GridViewProps, container: Gtk.GridView, rootContainer: Container) {
        super(typeName, props, container, rootContainer);
        this.list = new ListModel(
            { owner: this, signalStore: this.signalStore },
            {
                selectionMode: props.selectionMode,
                selected: props.selected,
                onSelectionChanged: props.onSelectionChanged,
            },
            true,
        );
        this.itemRenderer = new GridItemRenderer(this.signalStore);
        this.itemRenderer.setStore(this.list.getFlatStore());
        this.list.setOnItemUpdated((id) => this.itemRenderer.rebindItem(id));
        this.container.setFactory(this.itemRenderer.getFactory());
    }

    public override isValidChild(child: Node): boolean {
        if (child instanceof EventControllerNode || child instanceof SlotNode || child instanceof ContainerSlotNode)
            return true;
        if (child instanceof ListSectionNode) return true;
        if (!(child instanceof ListItemNode)) return false;
        if (child.getChildNodes().length > 0) {
            throw new Error("GtkGridView does not support nested ListItems. Use GtkListView for tree lists.");
        }
        return true;
    }

    public override appendChild(child: GridViewChild): void {
        super.appendChild(child);
        if (child instanceof ListItemNode || child instanceof ListSectionNode) {
            this.list.appendChild(child);
        }
    }

    public override insertBefore(child: GridViewChild, before: GridViewChild): void {
        super.insertBefore(child, before);
        if (
            (child instanceof ListItemNode || child instanceof ListSectionNode) &&
            (before instanceof ListItemNode || before instanceof ListSectionNode)
        ) {
            this.list.insertBefore(child, before);
        }
    }

    public override removeChild(child: GridViewChild): void {
        if (child instanceof ListItemNode || child instanceof ListSectionNode) {
            this.list.removeChild(child);
        }
        super.removeChild(child);
    }

    public override finalizeInitialChildren(props: GridViewProps): boolean {
        super.finalizeInitialChildren(props);
        return true;
    }

    public override commitUpdate(oldProps: GridViewProps | null, newProps: GridViewProps): void {
        super.commitUpdate(oldProps ? filterProps(oldProps, OWN_PROPS) : null, filterProps(newProps, OWN_PROPS));
        this.applyOwnProps(oldProps, newProps);
    }

    public override commitMount(): void {
        super.commitMount();
        this.list.flushBatch();
        this.container.setModel(this.list.getSelectionModel());
    }

    public override detachDeletedInstance(): void {
        this.itemRenderer.dispose();
        super.detachDeletedInstance();
    }

    private applyOwnProps(oldProps: GridViewProps | null, newProps: GridViewProps): void {
        if (hasChanged(oldProps, newProps, "renderItem")) {
            this.itemRenderer.setRenderFn(newProps.renderItem ?? null);
        }

        if (hasChanged(oldProps, newProps, "estimatedItemHeight")) {
            this.itemRenderer.setEstimatedItemHeight(newProps.estimatedItemHeight ?? null);
        }

        const previousModel = this.list.getSelectionModel();
        this.list.updateProps(
            oldProps ? filterProps(oldProps, RENDERER_PROPS) : null,
            filterProps(newProps, RENDERER_PROPS),
        );
        const currentModel = this.list.getSelectionModel();

        if (previousModel !== currentModel) {
            this.container.setModel(currentModel);
        }
    }
}

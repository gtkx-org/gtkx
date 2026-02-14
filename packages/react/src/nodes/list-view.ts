import type * as Gtk from "@gtkx/ffi/gtk";
import type { GtkListViewProps } from "../jsx.js";
import type { Node } from "../node.js";
import type { Container } from "../types.js";
import { ContainerSlotNode } from "./container-slot.js";
import { EventControllerNode } from "./event-controller.js";
import { GridItemRenderer } from "./internal/grid-item-renderer.js";
import type { HeaderItemRenderer } from "./internal/header-item-renderer.js";
import { updateHeaderRenderer } from "./internal/header-renderer-manager.js";
import { ListItemRenderer } from "./internal/list-item-renderer.js";
import { filterProps, hasChanged } from "./internal/props.js";
import { ListItemNode } from "./list-item.js";
import { ListSectionNode } from "./list-section.js";
import { ListModel, type ListModelProps } from "./models/list.js";
import { SlotNode } from "./slot.js";
import { WidgetNode } from "./widget.js";

const RENDERER_PROPS = ["renderItem", "renderHeader", "estimatedItemHeight"] as const;
const OWN_PROPS = [...RENDERER_PROPS, "autoexpand", "selectionMode", "selected", "onSelectionChanged"] as const;

type ListViewProps = Pick<GtkListViewProps, (typeof RENDERER_PROPS)[number]> & ListModelProps;

type ListViewChild = ListItemNode | ListSectionNode | EventControllerNode | SlotNode | ContainerSlotNode;

export class ListViewNode extends WidgetNode<Gtk.ListView, ListViewProps, ListViewChild> {
    private treeRenderer: ListItemRenderer | null = null;
    private flatRenderer: GridItemRenderer | null = null;
    private headerRenderer: HeaderItemRenderer | null = null;
    private list: ListModel;

    public override isValidChild(child: Node): boolean {
        return (
            child instanceof ListItemNode ||
            child instanceof ListSectionNode ||
            child instanceof EventControllerNode ||
            child instanceof SlotNode ||
            child instanceof ContainerSlotNode
        );
    }

    constructor(typeName: string, props: ListViewProps, container: Gtk.ListView, rootContainer: Container) {
        super(typeName, props, container, rootContainer);

        const flat = props.renderHeader != null;

        this.list = new ListModel(
            { owner: this, signalStore: this.signalStore },
            {
                autoexpand: flat ? undefined : props.autoexpand,
                selectionMode: props.selectionMode,
                selected: props.selected,
                onSelectionChanged: props.onSelectionChanged,
            },
            flat,
        );

        if (flat) {
            const store = this.list.getFlatStore();
            this.flatRenderer = new GridItemRenderer(this.signalStore);
            this.flatRenderer.setStore(store);
            store.setOnItemUpdated((id) => this.flatRenderer?.rebindItem(id));
            this.container.setFactory(this.flatRenderer.getFactory());
        } else {
            const store = this.list.getStore();
            this.treeRenderer = new ListItemRenderer(this.signalStore);
            this.treeRenderer.setStore(store);
            store.setOnItemUpdated((id) => this.treeRenderer?.rebindItem(id));
            this.container.setFactory(this.treeRenderer.getFactory());
        }
    }

    public override appendChild(child: ListViewChild): void {
        super.appendChild(child);
        if (child instanceof ListItemNode || child instanceof ListSectionNode) {
            this.list.appendChild(child);
        }
    }

    public override insertBefore(child: ListViewChild, before: ListViewChild): void {
        super.insertBefore(child, before);
        if (
            (child instanceof ListItemNode || child instanceof ListSectionNode) &&
            (before instanceof ListItemNode || before instanceof ListSectionNode)
        ) {
            this.list.insertBefore(child, before);
        }
    }

    public override removeChild(child: ListViewChild): void {
        if (child instanceof ListItemNode || child instanceof ListSectionNode) {
            this.list.removeChild(child);
        }
        super.removeChild(child);
    }

    public override finalizeInitialChildren(props: ListViewProps): boolean {
        super.finalizeInitialChildren(props);
        return true;
    }

    public override commitUpdate(oldProps: ListViewProps | null, newProps: ListViewProps): void {
        super.commitUpdate(oldProps ? filterProps(oldProps, OWN_PROPS) : null, filterProps(newProps, OWN_PROPS));
        this.applyOwnProps(oldProps, newProps);
    }

    public override commitMount(): void {
        super.commitMount();
        this.list.flushBatch();
        this.container.setModel(this.list.getSelectionModel());
    }

    public override detachDeletedInstance(): void {
        this.treeRenderer?.dispose();
        this.flatRenderer?.dispose();
        this.headerRenderer?.dispose();
        super.detachDeletedInstance();
    }

    private applyOwnProps(oldProps: ListViewProps | null, newProps: ListViewProps): void {
        if (hasChanged(oldProps, newProps, "renderItem")) {
            if (this.treeRenderer) {
                this.treeRenderer.setRenderFn(newProps.renderItem ?? null);
            }
            if (this.flatRenderer) {
                const renderItem = newProps.renderItem;
                this.flatRenderer.setRenderFn(renderItem ? (item: unknown) => renderItem(item, null) : null);
            }
        }

        if (hasChanged(oldProps, newProps, "estimatedItemHeight")) {
            const height = newProps.estimatedItemHeight ?? null;
            if (this.treeRenderer) {
                this.treeRenderer.setEstimatedItemHeight(height);
            }
            if (this.flatRenderer) {
                this.flatRenderer.setEstimatedItemHeight(height);
            }
        }

        if (hasChanged(oldProps, newProps, "renderHeader")) {
            this.headerRenderer = updateHeaderRenderer(
                this.headerRenderer,
                {
                    signalStore: this.signalStore,
                    isEnabled: () => this.list.isFlatMode(),
                    resolveItem: (id) => this.list.getFlatStore().getHeaderValue(id),
                    setFactory: (factory) => this.container.setHeaderFactory(factory),
                },
                newProps.renderHeader,
            );
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

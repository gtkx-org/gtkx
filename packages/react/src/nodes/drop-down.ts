import * as Gtk from "@gtkx/ffi/gtk";
import type { ReactNode } from "react";
import type Reconciler from "react-reconciler";
import { createFiberRoot } from "../fiber-root.js";
import type { AdwComboRowProps, GtkDropDownProps } from "../jsx.js";
import type { Node } from "../node.js";
import { reconciler } from "../reconciler.js";
import type { DropDownWidget } from "../registry.js";
import type { Container } from "../types.js";
import { ContainerSlotNode } from "./container-slot.js";
import { EventControllerNode } from "./event-controller.js";
import type { HeaderItemRenderer } from "./internal/header-item-renderer.js";
import { updateHeaderRenderer } from "./internal/header-renderer-manager.js";
import { filterProps, hasChanged } from "./internal/props.js";
import { SimpleListStore } from "./internal/simple-list-store.js";
import { ListItemNode } from "./list-item.js";
import { ListSectionNode } from "./list-section.js";
import { SlotNode } from "./slot.js";
import { WidgetNode } from "./widget.js";

const OWN_PROPS = ["selectedId", "onSelectionChanged", "renderItem", "renderListItem", "renderHeader"] as const;

type DropDownProps = Pick<GtkDropDownProps | AdwComboRowProps, (typeof OWN_PROPS)[number]>;

type DropDownChild = ListItemNode | ListSectionNode | EventControllerNode | SlotNode | ContainerSlotNode;

type RenderItemFn = (item: string | null) => ReactNode;

interface FactoryState {
    factory: Gtk.SignalListItemFactory;
    fiberRoots: Map<object, Reconciler.FiberRoot>;
    tornDown: Set<object>;
    boundLabels: Map<string, object>;
}

export class DropDownNode extends WidgetNode<DropDownWidget, DropDownProps, DropDownChild> {
    private store = new SimpleListStore();
    private initialSelectedId: string | null | undefined;

    private itemState: FactoryState | null = null;
    private renderItemFn: RenderItemFn | null = null;

    private listItemState: FactoryState | null = null;
    private renderListItemFn: RenderItemFn | null = null;

    private headerRenderer: HeaderItemRenderer | null = null;

    public override isValidChild(child: Node): boolean {
        return (
            child instanceof ListItemNode ||
            child instanceof ListSectionNode ||
            child instanceof EventControllerNode ||
            child instanceof SlotNode ||
            child instanceof ContainerSlotNode
        );
    }

    constructor(typeName: string, props: DropDownProps, container: DropDownWidget, rootContainer: Container) {
        super(typeName, props, container, rootContainer);
        this.store.beginBatch();
        this.initialSelectedId = props.selectedId;
    }

    public override finalizeInitialChildren(props: DropDownProps): boolean {
        super.finalizeInitialChildren(props);
        this.store.flushBatch();
        this.container.setModel(this.store.getModel());
        this.reapplyInitialSelectedId();
        return false;
    }

    private reapplyInitialSelectedId(): void {
        if (this.initialSelectedId == null) return;
        const index = this.store.getIndexById(this.initialSelectedId);
        this.initialSelectedId = undefined;
        if (index !== null) {
            this.container.setSelected(index);
        }
    }

    public override appendChild(child: DropDownChild): void {
        super.appendChild(child);
        if (child instanceof ListSectionNode) {
            this.store.addSection(child.props.id, child.props.value);
            child.setStore(this.store);
        } else if (child instanceof ListItemNode) {
            child.setStore(this.store);
            this.store.addItem(child.props.id, child.props.value as string);
        }
    }

    public override insertBefore(child: DropDownChild, before: DropDownChild): void {
        super.insertBefore(child, before);
        if (child instanceof ListSectionNode) {
            this.store.addSection(child.props.id, child.props.value);
            child.setStore(this.store);
        } else if (child instanceof ListItemNode && before instanceof ListItemNode) {
            child.setStore(this.store);
            this.store.insertItemBefore(child.props.id, before.props.id, child.props.value as string);
        } else if (child instanceof ListItemNode) {
            child.setStore(this.store);
            this.store.addItem(child.props.id, child.props.value as string);
        }
    }

    public override removeChild(child: DropDownChild): void {
        if (child instanceof ListSectionNode) {
            this.store.removeSection(child.props.id);
            child.setStore(null);
        } else if (child instanceof ListItemNode) {
            this.store.removeItem(child.props.id);
            child.setStore(null);
        }
        super.removeChild(child);
    }

    public override commitUpdate(oldProps: DropDownProps | null, newProps: DropDownProps): void {
        super.commitUpdate(oldProps ? filterProps(oldProps, OWN_PROPS) : null, filterProps(newProps, OWN_PROPS));
        this.applyOwnProps(oldProps, newProps);
    }

    public override detachDeletedInstance(): void {
        this.disposeFactory(this.itemState);
        this.itemState = null;
        this.disposeFactory(this.listItemState);
        this.listItemState = null;
        this.headerRenderer?.dispose();
        super.detachDeletedInstance();
    }

    private applyOwnProps(oldProps: DropDownProps | null, newProps: DropDownProps): void {
        if (hasChanged(oldProps, newProps, "onSelectionChanged")) {
            const onSelectionChanged = newProps.onSelectionChanged;

            const handleSelectionChange = onSelectionChanged
                ? () => {
                      const selectedIndex = this.container.getSelected();
                      const id = this.store.getIdAtIndex(selectedIndex);
                      if (id !== null) {
                          onSelectionChanged(id);
                      }
                  }
                : undefined;

            this.signalStore.set(this, this.container, "notify::selected", handleSelectionChange);
        }

        if (hasChanged(oldProps, newProps, "selectedId")) {
            const index = newProps.selectedId != null ? this.store.getIndexById(newProps.selectedId) : null;

            if (index !== null) {
                this.container.setSelected(index);
            }
        }

        if (hasChanged(oldProps, newProps, "renderItem")) {
            if (newProps.renderItem) {
                if (!this.itemState) {
                    this.itemState = this.createFactory(
                        () => this.renderItemFn,
                        (f) => this.container.setFactory(f),
                    );
                }
                this.renderItemFn = newProps.renderItem;
                this.rebindAll(this.itemState, this.renderItemFn);
            } else if (this.itemState) {
                this.disposeFactory(this.itemState);
                this.itemState = null;
                this.container.setFactory(null);
                this.renderItemFn = null;
            }
        }

        if (hasChanged(oldProps, newProps, "renderListItem")) {
            if (newProps.renderListItem) {
                if (!this.listItemState) {
                    this.listItemState = this.createFactory(
                        () => this.renderListItemFn,
                        (f) => this.container.setListFactory(f),
                    );
                }
                this.renderListItemFn = newProps.renderListItem;
                this.rebindAll(this.listItemState, this.renderListItemFn);
            } else if (this.listItemState) {
                this.disposeFactory(this.listItemState);
                this.listItemState = null;
                this.container.setListFactory(null);
                this.renderListItemFn = null;
            }
        }

        if (hasChanged(oldProps, newProps, "renderHeader")) {
            this.headerRenderer = updateHeaderRenderer(
                this.headerRenderer,
                {
                    signalStore: this.signalStore,
                    isEnabled: () => this.store.isSectioned(),
                    resolveItem: (label) => this.store.getHeaderValueByLabel(label),
                    setFactory: (factory) => this.container.setHeaderFactory(factory),
                },
                newProps.renderHeader,
            );
        }
    }

    private createFactory(
        getRenderFn: () => RenderItemFn | null,
        applyFactory: (factory: Gtk.SignalListItemFactory) => void,
    ): FactoryState {
        const state: FactoryState = {
            factory: new Gtk.SignalListItemFactory(),
            fiberRoots: new Map(),
            tornDown: new Set(),
            boundLabels: new Map(),
        };

        this.signalStore.set(this, state.factory, "setup", (listItem: Gtk.ListItem) => {
            const box = new Gtk.Box(Gtk.Orientation.HORIZONTAL);
            box.setValign(Gtk.Align.CENTER);
            listItem.setChild(box);
            const fiberRoot = createFiberRoot(box);
            state.fiberRoots.set(listItem, fiberRoot);
            const element = getRenderFn()?.(null);
            reconciler.getInstance().updateContainer(element, fiberRoot, null, () => {});
        });

        this.signalStore.set(this, state.factory, "bind", (listItem: Gtk.ListItem) => {
            const fiberRoot = state.fiberRoots.get(listItem);
            if (!fiberRoot) return;
            const stringObject = listItem.getItem();
            const label = stringObject instanceof Gtk.StringObject ? stringObject.getString() : null;
            if (label !== null) state.boundLabels.set(label, listItem);
            const element = getRenderFn()?.(label);
            reconciler.getInstance().updateContainer(element, fiberRoot, null, () => {});
        });

        this.signalStore.set(this, state.factory, "unbind", (listItem: Gtk.ListItem) => {
            const stringObject = listItem.getItem();
            if (stringObject instanceof Gtk.StringObject) {
                state.boundLabels.delete(stringObject.getString());
            }
        });

        this.signalStore.set(this, state.factory, "teardown", (listItem: Gtk.ListItem) => {
            const fiberRoot = state.fiberRoots.get(listItem);
            if (fiberRoot) {
                state.tornDown.add(listItem);
                reconciler.getInstance().updateContainer(null, fiberRoot, null, () => {});
                queueMicrotask(() => {
                    state.fiberRoots.delete(listItem);
                    state.tornDown.delete(listItem);
                });
            }
        });

        applyFactory(state.factory);
        return state;
    }

    private rebindAll(state: FactoryState, renderFn: RenderItemFn): void {
        for (const [label, listItem] of state.boundLabels) {
            const fiberRoot = state.fiberRoots.get(listItem);
            if (!fiberRoot) continue;
            const element = renderFn(label);
            reconciler.getInstance().updateContainer(element, fiberRoot, null, () => {});
        }
    }

    private disposeFactory(state: FactoryState | null): void {
        if (!state) return;
        this.signalStore.set(this, state.factory, "setup", undefined);
        this.signalStore.set(this, state.factory, "bind", undefined);
        this.signalStore.set(this, state.factory, "unbind", undefined);
        this.signalStore.set(this, state.factory, "teardown", undefined);
        for (const [listItem, fiberRoot] of state.fiberRoots) {
            if (!state.tornDown.has(listItem)) {
                reconciler.getInstance().updateContainer(null, fiberRoot, null, () => {});
            }
        }
        state.fiberRoots.clear();
        state.tornDown.clear();
        state.boundLabels.clear();
    }
}

import * as GObject from "@gtkx/ffi/gobject";
import * as Gtk from "@gtkx/ffi/gtk";
import { scheduleFlush } from "../batch.js";
import type { ItemContainer } from "../containers.js";
import type { Props } from "../factory.js";
import type { Node } from "../node.js";
import { Node as NodeClass } from "../node.js";
import { getCallbackChange } from "../props.js";
import { VirtualItemNode } from "./virtual-item.js";

export type SelectableListState = {
    itemsById: Map<string, unknown>;
    itemOrder: string[];
    committedOrder: string[];
    stringList: Gtk.StringList;
    selectionModel: Gtk.SingleSelection | Gtk.MultiSelection;
    selectionMode: Gtk.SelectionMode;
    selected: string[];
    onSelectionChanged?: (ids: string[]) => void;
    selectionHandlerId: number | null;
    needsSync: boolean;
    needsInitialSelection: boolean;
};

type SelectableListWidget = Gtk.Widget & {
    setModel(model: Gtk.SelectionModel): void;
};

export abstract class SelectableListNode<T extends SelectableListWidget, S extends SelectableListState>
    extends NodeClass<T, S>
    implements ItemContainer<unknown>
{
    override appendChild(child: Node): void {
        if (child instanceof VirtualItemNode) {
            child.parent = this;
            child.addToContainer(this);
            child.setParentContainer(this);
            return;
        }
        super.appendChild(child);
    }

    override insertBefore(child: Node, before: Node): void {
        if (child instanceof VirtualItemNode) {
            child.parent = this;
            if (before instanceof VirtualItemNode) {
                child.insertBeforeInContainer(this, before.getId());
            } else {
                child.addToContainer(this);
            }
            child.setParentContainer(this);
            return;
        }
        super.insertBefore(child, before);
    }

    override removeChild(child: Node): void {
        if (child instanceof VirtualItemNode) {
            child.unmount();
            child.parent = null;
            return;
        }
        super.removeChild(child);
    }

    protected initializeSelectionState(props: Props): SelectableListState {
        const selectionMode = (props.selectionMode as Gtk.SelectionMode | undefined) ?? Gtk.SelectionMode.SINGLE;
        const stringList = new Gtk.StringList([]);

        const selectionModel =
            selectionMode === Gtk.SelectionMode.MULTIPLE
                ? new Gtk.MultiSelection(stringList)
                : new Gtk.SingleSelection(stringList);

        if (selectionModel instanceof Gtk.SingleSelection) {
            selectionModel.setAutoselect(false);
            selectionModel.setCanUnselect(true);
        }

        return {
            itemsById: new Map(),
            itemOrder: [],
            committedOrder: [],
            stringList,
            selectionModel,
            selectionMode,
            selected: (props.selected as string[] | undefined) ?? [],
            onSelectionChanged: props.onSelectionChanged as ((ids: string[]) => void) | undefined,
            selectionHandlerId: null,
            needsSync: false,
            needsInitialSelection: true,
        };
    }

    protected applySelectionModel(): void {
        this.widget.setModel(this.state.selectionModel);
    }

    protected cleanupSelection(): void {
        this.disconnectSelectionHandler();
    }

    protected updateSelectionProps(oldProps: Props, newProps: Props): void {
        const oldSelectionMode = oldProps.selectionMode as Gtk.SelectionMode | undefined;
        const newSelectionMode = newProps.selectionMode as Gtk.SelectionMode | undefined;
        const effectiveOldMode = oldSelectionMode ?? Gtk.SelectionMode.SINGLE;
        const effectiveNewMode = newSelectionMode ?? Gtk.SelectionMode.SINGLE;

        if (effectiveOldMode !== effectiveNewMode) {
            this.recreateSelectionModel(effectiveNewMode);
        }

        const oldCallback = oldProps.onSelectionChanged as ((ids: string[]) => void) | undefined;
        const newCallback = newProps.onSelectionChanged as ((ids: string[]) => void) | undefined;
        const change = getCallbackChange(oldCallback, newCallback);

        if (change.action !== "none") {
            this.state.onSelectionChanged = change.callback;
            if (change.action === "disconnect") {
                this.disconnectSelectionHandler();
            } else if (change.action === "connect") {
                this.connectSelectionHandler();
            }
        }

        const oldSelected = oldProps.selected as string[] | undefined;
        const newSelected = newProps.selected as string[] | undefined;

        if (oldSelected !== newSelected && newSelected !== undefined) {
            this.state.selected = newSelected;
            this.applySelection(newSelected);
        }
    }

    private recreateSelectionModel(newSelectionMode: Gtk.SelectionMode): void {
        const currentSelection = this.getSelectedIds();
        const hadHandler = this.state.selectionHandlerId !== null;

        this.disconnectSelectionHandler();

        const listModel = this.state.stringList;
        const newSelectionModel =
            newSelectionMode === Gtk.SelectionMode.MULTIPLE
                ? new Gtk.MultiSelection(listModel)
                : new Gtk.SingleSelection(listModel);

        if (newSelectionModel instanceof Gtk.SingleSelection) {
            newSelectionModel.setAutoselect(false);
            newSelectionModel.setCanUnselect(true);
        }

        this.state.selectionModel = newSelectionModel;
        this.state.selectionMode = newSelectionMode;
        this.applySelectionModel();

        this.applySelection(currentSelection);

        if (hadHandler && this.state.onSelectionChanged) {
            this.connectSelectionHandler();
        }
    }

    getItems(): unknown[] {
        return this.state.itemOrder.map((id) => this.state.itemsById.get(id));
    }

    getItemById(id: string): unknown {
        return this.state.itemsById.get(id);
    }

    addItem(id: string, data: unknown): void {
        this.state.itemsById.set(id, data);

        const existingIndex = this.state.itemOrder.indexOf(id);
        if (existingIndex !== -1) {
            this.state.itemOrder.splice(existingIndex, 1);
        }
        this.state.itemOrder.push(id);
        this.scheduleSync();
    }

    insertItemBefore(id: string, data: unknown, beforeId: string): void {
        this.state.itemsById.set(id, data);

        const existingIndex = this.state.itemOrder.indexOf(id);
        if (existingIndex !== -1) {
            this.state.itemOrder.splice(existingIndex, 1);
        }

        const beforeIndex = this.state.itemOrder.indexOf(beforeId);
        if (beforeIndex === -1) {
            this.state.itemOrder.push(id);
        } else {
            this.state.itemOrder.splice(beforeIndex, 0, id);
        }
        this.scheduleSync();
    }

    removeItem(id: string): void {
        const index = this.state.itemOrder.indexOf(id);
        if (index !== -1) {
            this.state.itemOrder.splice(index, 1);
            this.state.itemsById.delete(id);
            this.scheduleSync();
        }
    }

    updateItem(id: string, data: unknown): void {
        if (this.state.itemsById.has(id)) {
            this.state.itemsById.set(id, data);
        }
    }

    protected scheduleSync(): void {
        if (!this.state.needsSync) {
            this.state.needsSync = true;
            scheduleFlush(this.syncModel);
        }
    }

    protected syncModel = (): void => {
        if (!this.state.needsSync) return;
        this.state.needsSync = false;

        const oldOrder = this.state.committedOrder;
        const newOrder = this.state.itemOrder;

        let firstDiff = 0;
        const minLen = Math.min(oldOrder.length, newOrder.length);
        while (firstDiff < minLen && oldOrder[firstDiff] === newOrder[firstDiff]) {
            firstDiff++;
        }

        let oldEndOffset = 0;
        let newEndOffset = 0;
        while (
            oldEndOffset < oldOrder.length - firstDiff &&
            newEndOffset < newOrder.length - firstDiff &&
            oldOrder[oldOrder.length - 1 - oldEndOffset] === newOrder[newOrder.length - 1 - newEndOffset]
        ) {
            oldEndOffset++;
            newEndOffset++;
        }

        const removeCount = oldOrder.length - firstDiff - oldEndOffset;
        const addItems = newOrder.slice(firstDiff, newOrder.length - newEndOffset);

        if (removeCount > 0 || addItems.length > 0) {
            this.state.stringList.splice(firstDiff, removeCount, addItems);
        }

        this.state.committedOrder = [...newOrder];

        if (this.state.needsInitialSelection && this.state.itemOrder.length > 0) {
            this.state.needsInitialSelection = false;
            queueMicrotask(() => {
                if (this.hasParent()) {
                    this.applyInitialSelection();
                }
            });
        }
    };

    protected applyInitialSelection(): void {
        this.applySelection(this.state.selected);
        if (this.state.onSelectionChanged) {
            this.connectSelectionHandler();
            this.state.onSelectionChanged(this.getSelectedIds());
        }
    }

    protected applySelection(ids: string[]): void {
        if (this.state.selectionMode === Gtk.SelectionMode.MULTIPLE) {
            const multiSelection = this.state.selectionModel as Gtk.MultiSelection;
            multiSelection.unselectAll();
            for (const id of ids) {
                const index = this.state.itemOrder.indexOf(id);
                if (index !== -1) {
                    multiSelection.selectItem(index, false);
                }
            }
        } else {
            const singleSelection = this.state.selectionModel as Gtk.SingleSelection;
            const firstId = ids[0];
            if (firstId !== undefined) {
                const index = this.state.itemOrder.indexOf(firstId);
                if (index !== -1) {
                    singleSelection.setSelected(index);
                }
            } else {
                singleSelection.setSelected(Gtk.INVALID_LIST_POSITION);
            }
        }
    }

    protected getSelectedIds(): string[] {
        const selection = this.state.selectionModel.getSelection();
        const count = Number(selection.getSize());
        const selectedIds: string[] = [];

        for (let i = 0; i < count; i++) {
            const position = selection.getNth(i);
            const id = this.state.itemOrder[position];
            if (id !== undefined) {
                selectedIds.push(id);
            }
        }

        return selectedIds;
    }

    protected connectSelectionHandler(): void {
        if (this.state.selectionHandlerId !== null) return;

        this.state.selectionHandlerId = this.state.selectionModel.connect("selection-changed", () => {
            this.state.onSelectionChanged?.(this.getSelectedIds());
        });
    }

    protected disconnectSelectionHandler(): void {
        if (this.state.selectionHandlerId !== null) {
            GObject.signalHandlerDisconnect(this.state.selectionModel, this.state.selectionHandlerId);
            this.state.selectionHandlerId = null;
        }
    }
}

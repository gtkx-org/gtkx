import type * as Gio from "@gtkx/ffi/gio";
import type * as Gtk from "@gtkx/ffi/gtk";
import type { StringListContainer } from "../containers.js";
import type { Props } from "../factory.js";
import type { Node } from "../node.js";
import { Node as NodeClass } from "../node.js";
import { getCallbackChange } from "../props.js";
import { StringListItemNode } from "./string-list-item.js";
import { StringListStore } from "./string-list-store.js";

type StringListContainerState = {
    store: StringListStore;
    onSelectionChanged?: (id: string) => void;
    initialSelection?: string;
    hasAppliedInitialSelection: boolean;
};

type StringListWidget = Gtk.Widget & {
    setModel(model?: Gio.ListModel): void;
    getSelected(): number;
    setSelected(position: number): void;
};

const SELECTION_SIGNAL = "notify::selected";

export abstract class StringListContainerNode<T extends StringListWidget>
    extends NodeClass<T, StringListContainerState>
    implements StringListContainer
{
    static override consumedPropNames = ["onSelectionChanged", "selectedId"];

    override appendChild(child: Node): void {
        if (child instanceof StringListItemNode) {
            child.parent = this;
            child.addToContainer(this);
            child.setParentContainer(this);
            return;
        }
        super.appendChild(child);
    }

    override insertBefore(child: Node, before: Node): void {
        if (child instanceof StringListItemNode) {
            child.parent = this;
            if (before instanceof StringListItemNode) {
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
        if (child instanceof StringListItemNode) {
            child.unmount();
            child.parent = null;
            return;
        }
        super.removeChild(child);
    }

    override initialize(props: Props): void {
        const store = new StringListStore();
        const onSelectionChanged = props.onSelectionChanged as ((id: string) => void) | undefined;
        const initialSelection = props.selectedId as string | undefined;

        this.state = { store, onSelectionChanged, initialSelection, hasAppliedInitialSelection: false };

        super.initialize(props);

        this.widget.setModel(store.getModel());
    }

    private connectSelectionHandler(): void {
        const handler = () => {
            const index = this.widget.getSelected();
            const id = this.state.store.getIdAtIndex(index);
            if (id !== undefined) {
                this.state.onSelectionChanged?.(id);
            }
        };

        this.connectSignal(this.widget, SELECTION_SIGNAL, handler);
    }

    addStringListItem(id: string, label: string): void {
        this.state.store.append(id, label);
        this.scheduleInitialSelectionIfNeeded();
    }

    private scheduleInitialSelectionIfNeeded(): void {
        if (!this.state.hasAppliedInitialSelection) {
            this.state.hasAppliedInitialSelection = true;
            queueMicrotask(() => this.applyInitialSelection());
        }
    }

    private applyInitialSelection(): void {
        if (this.state.initialSelection !== undefined) {
            const index = this.state.store.getIndexForId(this.state.initialSelection);
            if (index !== -1) {
                this.widget.setSelected(index);
            }
        }

        if (this.state.onSelectionChanged) {
            this.connectSelectionHandler();

            const currentIndex = this.widget.getSelected();
            const id = this.state.store.getIdAtIndex(currentIndex);
            if (id !== undefined) {
                this.state.onSelectionChanged(id);
            }
        }
    }

    insertStringListItemBefore(id: string, label: string, beforeId: string): void {
        this.state.store.insertBefore(id, label, beforeId);
    }

    removeStringListItem(id: string): void {
        this.state.store.remove(id);
    }

    updateStringListItem(oldId: string, newId: string, newLabel: string): void {
        this.state.store.update(oldId, newId, newLabel);
    }

    override updateProps(oldProps: Props, newProps: Props): void {
        const oldCallback = oldProps.onSelectionChanged as ((id: string) => void) | undefined;
        const newCallback = newProps.onSelectionChanged as ((id: string) => void) | undefined;
        const change = getCallbackChange(oldCallback, newCallback);

        if (change.action !== "none") {
            this.state.onSelectionChanged = change.callback;

            if (change.action === "disconnect") {
                this.disconnectSignal(SELECTION_SIGNAL);
            } else if (change.action === "connect") {
                this.connectSelectionHandler();
            }
        }

        const oldSelected = oldProps.selectedId as string | undefined;
        const newSelected = newProps.selectedId as string | undefined;

        if (oldSelected !== newSelected && newSelected !== undefined) {
            this.state.initialSelection = newSelected;
            const index = this.state.store.getIndexForId(newSelected);
            if (index !== -1) {
                this.widget.setSelected(index);
            }
        }

        super.updateProps(oldProps, newProps);
    }
}

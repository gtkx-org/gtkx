import type * as Adw from "@gtkx/ffi/adw";
import type * as Gtk from "@gtkx/ffi/gtk";
import type { Node } from "../node.js";
import type { Container, Props } from "../types.js";
import { SimpleListStore } from "./internal/simple-list-store.js";
import { filterProps } from "./internal/utils.js";
import { SimpleListItemNode } from "./simple-list-item.js";
import { WidgetNode } from "./widget.js";

const PROP_NAMES = ["selectedId", "onSelectionChanged"] as const;

type SimpleListViewProps = Props & {
    selectedId?: string;
    onSelectionChanged?: (id: string) => void;
};

export class SimpleListViewNode extends WidgetNode<Gtk.DropDown | Adw.ComboRow, SimpleListViewProps> {
    private store = new SimpleListStore();

    constructor(
        typeName: string,
        props: SimpleListViewProps,
        container: Gtk.DropDown | Adw.ComboRow,
        rootContainer: Container,
    ) {
        super(typeName, props, container, rootContainer);
        this.container.setModel(this.store.getModel());
    }

    public override updateProps(oldProps: SimpleListViewProps | null, newProps: SimpleListViewProps): void {
        if (!oldProps || oldProps.onSelectionChanged !== newProps.onSelectionChanged) {
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

        if (!oldProps || oldProps.selectedId !== newProps.selectedId) {
            const index = newProps.selectedId !== undefined ? this.store.getIndexById(newProps.selectedId) : null;

            if (index !== null) {
                this.container.setSelected(index);
            }
        }

        super.updateProps(oldProps ? filterProps(oldProps, PROP_NAMES) : null, filterProps(newProps, PROP_NAMES));
    }

    public override appendChild(child: Node): void {
        if (!(child instanceof SimpleListItemNode)) {
            throw new Error(`Cannot append '${child.typeName}' to 'DropDown': expected x.SimpleListItem`);
        }

        const { id, value } = child.props;

        if (!id || value === undefined) {
            throw new Error("Expected 'id' and 'value' props to be present on SimpleListItem");
        }

        child.setStore(this.store);
        this.store.addItem(id, value);
    }

    public override insertBefore(child: Node, before: Node): void {
        if (!(child instanceof SimpleListItemNode) || !(before instanceof SimpleListItemNode)) {
            throw new Error(`Cannot insert '${child.typeName}' into 'DropDown': expected x.SimpleListItem`);
        }

        const { id, value } = child.props;
        const beforeId = before.props.id;

        if (!id || value === undefined || !beforeId) {
            throw new Error("Expected 'id' and 'value' props to be present on SimpleListItem");
        }

        child.setStore(this.store);
        this.store.insertItemBefore(id, beforeId, value);
    }

    public override removeChild(child: Node): void {
        if (!(child instanceof SimpleListItemNode)) {
            throw new Error(`Cannot remove '${child.typeName}' from 'DropDown': expected x.SimpleListItem`);
        }

        const { id } = child.props;
        if (!id) {
            throw new Error("Expected 'id' prop to be present on SimpleListItem");
        }

        this.store.removeItem(id);
    }
}

import type * as Adw from "@gtkx/ffi/adw";
import type * as Gtk from "@gtkx/ffi/gtk";
import type { Container, Props } from "../types.js";
import { SimpleListStore } from "./internal/simple-list-store.js";
import type { SimpleListItemNode } from "./simple-list-item.js";
import { WidgetNode } from "./widget.js";

const PROP_NAMES = ["selectedId", "onSelectionChanged"] as const;

type SimpleListViewProps = Props & {
    selectedId?: string;
    onSelectionChanged?: (id: string) => void;
};

export class SimpleListViewNode extends WidgetNode<
    Gtk.DropDown | Adw.ComboRow,
    SimpleListViewProps,
    SimpleListItemNode
> {
    protected override readonly excludedPropNames = PROP_NAMES;
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

    public override commitUpdate(oldProps: SimpleListViewProps | null, newProps: SimpleListViewProps): void {
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

        super.commitUpdate(oldProps, newProps);
    }

    public override appendChild(child: SimpleListItemNode): void {
        super.appendChild(child);
        child.setStore(this.store);
        this.store.addItem(child.props.id, child.props.value);
    }

    public override insertBefore(child: SimpleListItemNode, before: SimpleListItemNode): void {
        super.insertBefore(child, before);
        child.setStore(this.store);
        this.store.insertItemBefore(child.props.id, before.props.id, child.props.value);
    }

    public override removeChild(child: SimpleListItemNode): void {
        this.store.removeItem(child.props.id);
        super.removeChild(child);
    }
}

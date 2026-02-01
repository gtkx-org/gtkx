import type { GtkDropDownProps } from "../jsx.js";
import type { SimpleListViewWidget } from "../registry.js";
import type { Container } from "../types.js";
import { filterProps } from "./internal/props.js";
import { SimpleListStore } from "./internal/simple-list-store.js";
import type { SimpleListItemNode } from "./simple-list-item.js";
import { WidgetNode } from "./widget.js";

const OWN_PROPS = ["selectedId", "onSelectionChanged"] as const;

type SimpleListViewProps = Pick<GtkDropDownProps, (typeof OWN_PROPS)[number]>;

export class SimpleListViewNode extends WidgetNode<SimpleListViewWidget, SimpleListViewProps, SimpleListItemNode> {
    private store = new SimpleListStore();

    constructor(
        typeName: string,
        props: SimpleListViewProps,
        container: SimpleListViewWidget,
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
            const index = newProps.selectedId != null ? this.store.getIndexById(newProps.selectedId) : null;

            if (index !== null) {
                this.container.setSelected(index);
            }
        }

        super.commitUpdate(oldProps ? filterProps(oldProps, OWN_PROPS) : null, filterProps(newProps, OWN_PROPS));
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

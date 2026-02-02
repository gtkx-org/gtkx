import type { AdwComboRowProps, GtkDropDownProps } from "../jsx.js";
import type { Node } from "../node.js";
import type { DropDownWidget } from "../registry.js";
import type { Container } from "../types.js";
import { filterProps, hasChanged } from "./internal/props.js";
import { SimpleListStore } from "./internal/simple-list-store.js";
import { ListItemNode } from "./list-item.js";
import { WidgetNode } from "./widget.js";

const OWN_PROPS = ["selectedId", "onSelectionChanged"] as const;

type DropDownProps = Pick<GtkDropDownProps | AdwComboRowProps, (typeof OWN_PROPS)[number]>;

export class DropDownNode extends WidgetNode<DropDownWidget, DropDownProps, ListItemNode> {
    private store = new SimpleListStore();

    public override isValidChild(child: Node): boolean {
        return child instanceof ListItemNode;
    }

    constructor(typeName: string, props: DropDownProps, container: DropDownWidget, rootContainer: Container) {
        super(typeName, props, container, rootContainer);
        this.container.setModel(this.store.getModel());
    }

    public override appendChild(child: ListItemNode): void {
        super.appendChild(child);
        child.setStore(this.store);
        this.store.addItem(child.props.id, child.props.value as string);
    }

    public override insertBefore(child: ListItemNode, before: ListItemNode): void {
        super.insertBefore(child, before);
        child.setStore(this.store);
        this.store.insertItemBefore(child.props.id, before.props.id, child.props.value as string);
    }

    public override removeChild(child: ListItemNode): void {
        this.store.removeItem(child.props.id);
        super.removeChild(child);
    }

    public override commitUpdate(oldProps: DropDownProps | null, newProps: DropDownProps): void {
        super.commitUpdate(oldProps ? filterProps(oldProps, OWN_PROPS) : null, filterProps(newProps, OWN_PROPS));
        this.applyOwnProps(oldProps, newProps);
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
    }
}

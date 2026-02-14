import type { ListSectionProps } from "../jsx.js";
import type { Node } from "../node.js";
import { hasChanged } from "./internal/props.js";
import { ListItemNode } from "./list-item.js";
import { VirtualNode } from "./virtual.js";

type SectionStore = {
    addItemToSection(sectionId: string, itemId: string, item: unknown): void;
    addItemsToSection(sectionId: string, items: { itemId: string; item: unknown }[]): void;
    removeItemFromSection(itemId: string): void;
    updateHeaderValue(sectionId: string, value: unknown): void;
    insertItemToSectionBefore(sectionId: string, itemId: string, beforeId: string, item: unknown): void;
    updateItem(id: string, item: unknown): void;
};

export class ListSectionNode extends VirtualNode<ListSectionProps, Node, ListItemNode> {
    private store: SectionStore | null = null;

    public override isValidChild(child: Node): boolean {
        return child instanceof ListItemNode;
    }

    public override appendChild(child: ListItemNode): void {
        super.appendChild(child);
        if (this.store) {
            this.store.addItemToSection(this.props.id, child.props.id, child.props.value);
        }
    }

    public override insertBefore(child: ListItemNode, before: ListItemNode): void {
        super.insertBefore(child, before);
        if (this.store) {
            this.store.insertItemToSectionBefore(this.props.id, child.props.id, before.props.id, child.props.value);
        }
    }

    public override removeChild(child: ListItemNode): void {
        if (this.store) {
            this.store.removeItemFromSection(child.props.id);
        }
        super.removeChild(child);
    }

    public override commitUpdate(oldProps: ListSectionProps | null, newProps: ListSectionProps): void {
        super.commitUpdate(oldProps, newProps);
        if (this.store && hasChanged(oldProps, newProps, "value")) {
            this.store.updateHeaderValue(newProps.id, newProps.value);
        }
    }

    public setStore(store: SectionStore | null): void {
        this.store = store;
        if (store && this.children.length > 0) {
            store.addItemsToSection(
                this.props.id,
                this.children.map((child) => ({ itemId: child.props.id, item: child.props.value })),
            );
        }
    }

    public getChildNodes(): readonly ListItemNode[] {
        return this.children;
    }
}

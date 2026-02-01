import type { ListItemProps } from "../jsx.js";
import type { Node } from "../node.js";
import { hasChanged } from "./internal/props.js";
import { type TreeItemData, TreeStore } from "./internal/tree-store.js";
import { VirtualNode } from "./virtual.js";

export const createItemData = (props: ListItemProps): TreeItemData => ({
    value: props.value,
    indentForDepth: props.indentForDepth,
    indentForIcon: props.indentForIcon,
    hideExpander: props.hideExpander,
});

export type ItemStore = { updateItem(id: string, value: unknown): void };

export class ListItemNode extends VirtualNode<ListItemProps, Node, ListItemNode> {
    private store: ItemStore | null = null;
    private parentItemId: string | null = null;

    public setStore(store: ItemStore | null): void {
        this.store = store;
        if (store === null || store instanceof TreeStore) {
            for (const child of this.children) {
                child.setStore(store);
            }
        }
    }

    public getChildNodes(): readonly ListItemNode[] {
        return this.children;
    }

    public setParentItemId(parentId: string | null): void {
        this.parentItemId = parentId;
    }

    public getParentItemId(): string | null {
        return this.parentItemId;
    }

    public override isValidChild(child: Node): boolean {
        return child instanceof ListItemNode;
    }

    public override appendChild(child: ListItemNode): void {
        super.appendChild(child);
        child.setParentItemId(this.props.id);

        if (this.store instanceof TreeStore) {
            this.store.addItem(child.props.id, createItemData(child.props), this.props.id);
            child.setStore(this.store);
        }
    }

    public override insertBefore(child: ListItemNode, before: ListItemNode): void {
        super.insertBefore(child, before);
        child.setParentItemId(this.props.id);

        if (this.store instanceof TreeStore) {
            this.store.insertItemBefore(child.props.id, before.props.id, createItemData(child.props), this.props.id);
            child.setStore(this.store);
        }
    }

    public override removeChild(child: ListItemNode): void {
        if (this.store instanceof TreeStore) {
            this.store.removeItem(child.props.id, this.props.id);
        }

        child.setStore(null);
        child.setParentItemId(null);
        super.removeChild(child);
    }

    public override commitUpdate(oldProps: ListItemProps | null, newProps: ListItemProps): void {
        super.commitUpdate(oldProps, newProps);

        if (!this.store) return;

        if (this.store instanceof TreeStore) {
            const propsChanged =
                !oldProps ||
                oldProps.id !== newProps.id ||
                oldProps.value !== newProps.value ||
                oldProps.indentForDepth !== newProps.indentForDepth ||
                oldProps.indentForIcon !== newProps.indentForIcon ||
                oldProps.hideExpander !== newProps.hideExpander;

            if (propsChanged) {
                this.store.updateItem(newProps.id, createItemData(newProps));
            }
        } else {
            if (hasChanged(oldProps, newProps, "id") || hasChanged(oldProps, newProps, "value")) {
                this.store.updateItem(newProps.id, newProps.value);
            }
        }
    }
}

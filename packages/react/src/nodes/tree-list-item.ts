import type { TreeListItemProps } from "../jsx.js";
import type { Node } from "../node.js";
import type { TreeItemData, TreeStore } from "./internal/tree-store.js";
import { VirtualNode } from "./virtual.js";

type Props = Partial<TreeListItemProps>;

export const createTreeItemData = (props: Props): TreeItemData => ({
    value: props.value,
    indentForDepth: props.indentForDepth,
    indentForIcon: props.indentForIcon,
    hideExpander: props.hideExpander,
});

export class TreeListItemNode extends VirtualNode<Props> {
    private store: TreeStore | null = null;
    private parentItemId: string | null = null;
    private childNodes: TreeListItemNode[] = [];

    public setStore(store: TreeStore | null): void {
        this.store = store;
        for (const child of this.childNodes) {
            child.setStore(store);
        }
    }

    public getChildNodes(): readonly TreeListItemNode[] {
        return this.childNodes;
    }

    public setParentItemId(parentId: string | null): void {
        this.parentItemId = parentId;
    }

    public getParentItemId(): string | null {
        return this.parentItemId;
    }

    public override isValidChild(child: Node): boolean {
        return child instanceof TreeListItemNode;
    }

    public override appendChild(child: Node): void {
        if (!(child instanceof TreeListItemNode)) {
            return;
        }

        super.appendChild(child);
        child.setStore(this.store);
        child.setParentItemId(this.props.id ?? null);
        this.childNodes.push(child);

        if (this.store && child.props.id !== undefined) {
            this.store.addItem(child.props.id, createTreeItemData(child.props), this.props.id);
        }
    }

    public override insertBefore(child: Node, before: Node): void {
        if (!(child instanceof TreeListItemNode) || !(before instanceof TreeListItemNode)) {
            return;
        }

        super.insertBefore(child, before);
        child.setStore(this.store);
        child.setParentItemId(this.props.id ?? null);

        const beforeIndex = this.childNodes.indexOf(before);
        if (beforeIndex === -1) {
            this.childNodes.push(child);
        } else {
            this.childNodes.splice(beforeIndex, 0, child);
        }

        if (this.store && child.props.id !== undefined && before.props.id !== undefined) {
            this.store.insertItemBefore(
                child.props.id,
                before.props.id,
                createTreeItemData(child.props),
                this.props.id,
            );
        }
    }

    public override removeChild(child: Node): void {
        if (!(child instanceof TreeListItemNode)) {
            return;
        }

        const index = this.childNodes.indexOf(child);
        if (index !== -1) {
            this.childNodes.splice(index, 1);
        }

        if (this.store && child.props.id !== undefined) {
            this.store.removeItem(child.props.id, this.props.id);
        }

        child.setStore(null);
        child.setParentItemId(null);
        super.removeChild(child);
    }

    public override commitUpdate(oldProps: Props | null, newProps: Props): void {
        super.commitUpdate(oldProps, newProps);

        if (!this.store) {
            return;
        }

        const propsChanged =
            !oldProps ||
            oldProps.id !== newProps.id ||
            oldProps.value !== newProps.value ||
            oldProps.indentForDepth !== newProps.indentForDepth ||
            oldProps.indentForIcon !== newProps.indentForIcon ||
            oldProps.hideExpander !== newProps.hideExpander;

        if (propsChanged && newProps.id !== undefined) {
            this.store.updateItem(newProps.id, createTreeItemData(newProps));
        }
    }
}

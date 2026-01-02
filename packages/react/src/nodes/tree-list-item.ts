import type { TreeListItemProps } from "../jsx.js";
import type { Node } from "../node.js";
import { registerNodeClass } from "../registry.js";
import { scheduleAfterCommit } from "../scheduler.js";
import type { TreeStore } from "./internal/tree-store.js";
import { VirtualNode } from "./virtual.js";

type Props = Partial<TreeListItemProps>;

export class TreeListItemNode extends VirtualNode<Props> {
    public static override priority = 1;

    private store?: TreeStore | null;
    private parentItemId?: string | null;
    private childNodes: TreeListItemNode[] = [];

    public static override matches(type: string): boolean {
        return type === "TreeListItem";
    }

    public setStore(store?: TreeStore | null): void {
        this.store = store;
        for (const child of this.childNodes) {
            child.setStore(store);
        }
    }

    public setParentItemId(parentId?: string | null): void {
        this.parentItemId = parentId;
    }

    public getParentItemId(): string | null {
        return this.parentItemId ?? null;
    }

    public override appendChild(child: Node): void {
        if (!(child instanceof TreeListItemNode)) {
            return;
        }

        child.setStore(this.store);
        child.setParentItemId(this.props.id);
        this.childNodes.push(child);

        scheduleAfterCommit(() => {
            if (this.store && child.props.id !== undefined) {
                this.store.addItem(
                    child.props.id,
                    {
                        value: child.props.value,
                        indentForDepth: child.props.indentForDepth,
                        indentForIcon: child.props.indentForIcon,
                        hideExpander: child.props.hideExpander,
                    },
                    this.props.id,
                );
            }
        });
    }

    public override insertBefore(child: Node, before: Node): void {
        if (!(child instanceof TreeListItemNode) || !(before instanceof TreeListItemNode)) {
            return;
        }

        child.setStore(this.store);
        child.setParentItemId(this.props.id);

        const beforeIndex = this.childNodes.indexOf(before);
        if (beforeIndex === -1) {
            this.childNodes.push(child);
        } else {
            this.childNodes.splice(beforeIndex, 0, child);
        }

        scheduleAfterCommit(() => {
            if (this.store && child.props.id !== undefined && before.props.id !== undefined) {
                this.store.insertItemBefore(
                    child.props.id,
                    before.props.id,
                    {
                        value: child.props.value,
                        indentForDepth: child.props.indentForDepth,
                        indentForIcon: child.props.indentForIcon,
                        hideExpander: child.props.hideExpander,
                    },
                    this.props.id,
                );
            }
        });
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
    }

    public override updateProps(oldProps: Props | null, newProps: Props): void {
        super.updateProps(oldProps, newProps);

        if (!this.store) {
            return;
        }

        if (
            !oldProps ||
            oldProps.id !== newProps.id ||
            oldProps.value !== newProps.value ||
            oldProps.indentForDepth !== newProps.indentForDepth ||
            oldProps.indentForIcon !== newProps.indentForIcon ||
            oldProps.hideExpander !== newProps.hideExpander
        ) {
            if (newProps.id !== undefined) {
                this.store.updateItem(newProps.id, {
                    value: newProps.value,
                    indentForDepth: newProps.indentForDepth,
                    indentForIcon: newProps.indentForIcon,
                    hideExpander: newProps.hideExpander,
                });
            }
        }
    }
}

registerNodeClass(TreeListItemNode);

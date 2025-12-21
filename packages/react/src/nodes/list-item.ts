import type { ListItemProps } from "../jsx.js";
import { registerNodeClass } from "../registry.js";
import type { ListStore } from "./internal/list-store.js";
import { VirtualNode } from "./virtual.js";

type Props = Partial<ListItemProps>;

export class ListItemNode<
    T extends Omit<ListStore, "items" | "model"> = ListStore,
    P extends Props = Props,
> extends VirtualNode<P> {
    public static override priority = 1;

    private store?: T;

    public static override matches(type: string): boolean {
        return type === "ListItem";
    }

    public setStore(store?: T): void {
        this.store = store;
    }

    public override updateProps(oldProps: P | null, newProps: P): void {
        if (!this.store) {
            return;
        }

        if (!oldProps || oldProps.id !== newProps.id || oldProps.value !== newProps.value) {
            if (newProps.id !== undefined) {
                this.store.updateItem(newProps.id, newProps.value);
            }
        }
    }
}

registerNodeClass(ListItemNode);

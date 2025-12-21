import type { StringListItemProps } from "../jsx.js";
import { registerNodeClass } from "../registry.js";
import type { SimpleListStore } from "./internal/simple-list-store.js";
import { ListItemNode } from "./list-item.js";

type Props = Partial<StringListItemProps>;

export class SimpleListItemNode extends ListItemNode<SimpleListStore, Props> {
    public static override priority = 1;

    public static override matches(type: string): boolean {
        return type === "SimpleListItem";
    }
}

registerNodeClass(SimpleListItemNode);

import type { StringListItemProps } from "../jsx.js";
import type { SimpleListStore } from "./internal/simple-list-store.js";
import { ListItemNode } from "./list-item.js";

type Props = StringListItemProps;

export class SimpleListItemNode extends ListItemNode<SimpleListStore, Props> {}

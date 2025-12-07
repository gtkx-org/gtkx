import type * as Gtk from "@gtkx/ffi/gtk";
import type { Node } from "./node.js";
import { ColumnViewColumnNode, ColumnViewItemNode, ColumnViewNode } from "./nodes/column-view.js";
import { DropDownItemNode, DropDownNode } from "./nodes/dropdown.js";
import { GridChildNode, GridNode } from "./nodes/grid.js";
import { ListItemNode, ListViewNode } from "./nodes/list.js";
import { NotebookNode, NotebookPageNode } from "./nodes/notebook.js";
import { OverlayNode } from "./nodes/overlay.js";
import { type ROOT_NODE_CONTAINER, RootNode } from "./nodes/root.js";
import { SlotNode } from "./nodes/slot.js";
import { TextViewNode } from "./nodes/text-view.js";
import { WidgetNode } from "./nodes/widget.js";

export type Props = Record<string, unknown>;
export { ROOT_NODE_CONTAINER } from "./nodes/root.js";

interface NodeClass {
    matches: (type: string, props: Props, existingWidget?: Gtk.Widget | typeof ROOT_NODE_CONTAINER) => boolean;
    new (
        type: string,
        props: Props,
        currentApp?: unknown,
        existingWidget?: Gtk.Widget | typeof ROOT_NODE_CONTAINER,
    ): Node;
}

const NODE_CLASSES = [
    RootNode,
    ColumnViewColumnNode,
    ColumnViewItemNode,
    ListItemNode,
    DropDownItemNode,
    GridChildNode,
    NotebookPageNode,
    SlotNode,
    TextViewNode,
    DropDownNode,
    GridNode,
    OverlayNode,
    ColumnViewNode,
    ListViewNode,
    NotebookNode,
    WidgetNode,
] as NodeClass[];

export const createNode = (
    type: string,
    props: Props,
    app: Gtk.Application,
    existingWidget?: Gtk.Widget | typeof ROOT_NODE_CONTAINER,
): Node => {
    for (const NodeClass of NODE_CLASSES) {
        if (NodeClass.matches(type, props, existingWidget)) {
            return new NodeClass(type, props, app, existingWidget);
        }
    }

    throw new Error(`No matching node class for type: ${type}`);
};

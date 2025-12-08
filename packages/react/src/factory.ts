import type * as Gtk from "@gtkx/ffi/gtk";
import type { Node } from "./node.js";
import { AboutDialogNode } from "./nodes/about-dialog.js";
import { ActionBarNode } from "./nodes/action-bar.js";
import { ColumnViewColumnNode, ColumnViewItemNode, ColumnViewNode } from "./nodes/column-view.js";
import { DropDownItemNode, DropDownNode } from "./nodes/dropdown.js";
import { FlowBoxNode } from "./nodes/flow-box.js";
import { GridChildNode, GridNode } from "./nodes/grid.js";
import { ListItemNode, ListViewNode } from "./nodes/list.js";
import { ListBoxNode } from "./nodes/list-box.js";
import { NotebookNode, NotebookPageNode } from "./nodes/notebook.js";
import { OverlayNode } from "./nodes/overlay.js";
import { type ROOT_NODE_CONTAINER, RootNode } from "./nodes/root.js";
import { SlotNode } from "./nodes/slot.js";
import { TextViewNode } from "./nodes/text-view.js";
import { WidgetNode } from "./nodes/widget.js";
import { WindowNode } from "./nodes/window.js";

export type Props = Record<string, unknown>;
export { ROOT_NODE_CONTAINER } from "./nodes/root.js";

interface NodeClass {
    matches: (type: string, existingWidget?: Gtk.Widget | typeof ROOT_NODE_CONTAINER) => boolean;
    new (type: string, props: Props, existingWidget?: Gtk.Widget | typeof ROOT_NODE_CONTAINER): Node;
}

const NODE_CLASSES = [
    RootNode,
    // Virtual nodes (no widget)
    ColumnViewColumnNode,
    ColumnViewItemNode,
    ListItemNode,
    DropDownItemNode,
    GridChildNode,
    NotebookPageNode,
    SlotNode,
    // Specialized widget nodes
    WindowNode,
    AboutDialogNode,
    TextViewNode,
    // Container nodes
    ActionBarNode,
    FlowBoxNode,
    ListBoxNode,
    DropDownNode,
    GridNode,
    OverlayNode,
    ColumnViewNode,
    ListViewNode,
    NotebookNode,
    // Catch-all (must be last)
    WidgetNode,
] as NodeClass[];

export const createNode = (
    type: string,
    props: Props,
    existingWidget?: Gtk.Widget | typeof ROOT_NODE_CONTAINER,
): Node => {
    for (const NodeClass of NODE_CLASSES) {
        if (NodeClass.matches(type, existingWidget)) {
            return new NodeClass(type, props, existingWidget);
        }
    }

    throw new Error(`No matching node class for type: ${type}`);
};

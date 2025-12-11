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
import {
    ApplicationMenuNode,
    MenuItemNode,
    MenuSectionNode,
    MenuSubmenuNode,
    PopoverMenuBarNode,
    PopoverMenuRootNode,
} from "./nodes/menu.js";
import { NotebookNode, NotebookPageNode } from "./nodes/notebook.js";
import { OverlayNode } from "./nodes/overlay.js";
import { type ROOT_NODE_CONTAINER, RootNode } from "./nodes/root.js";
import { SlotNode } from "./nodes/slot.js";
import { StackNode, StackPageNode } from "./nodes/stack.js";
import { TextViewNode } from "./nodes/text-view.js";
import { ToggleButtonNode } from "./nodes/toggle-button.js";
import { WidgetNode } from "./nodes/widget.js";
import { WindowNode } from "./nodes/window.js";

/**
 * Generic props type for React component properties passed to GTK nodes.
 */
export type Props = Record<string, unknown>;

export { ROOT_NODE_CONTAINER } from "./nodes/root.js";

interface NodeClass {
    matches: (type: string, existingWidget?: Gtk.Widget | typeof ROOT_NODE_CONTAINER) => boolean;
    new (type: string, existingWidget?: Gtk.Widget | typeof ROOT_NODE_CONTAINER): Node;
}

const VIRTUAL_NODES = [
    ColumnViewColumnNode,
    ColumnViewItemNode,
    ListItemNode,
    DropDownItemNode,
    GridChildNode,
    NotebookPageNode,
    StackPageNode,
    MenuItemNode,
    MenuSectionNode,
    MenuSubmenuNode,
    SlotNode,
] as NodeClass[];

const SPECIALIZED_NODES = [
    WindowNode,
    AboutDialogNode,
    TextViewNode,
    ToggleButtonNode,
    ApplicationMenuNode,
    PopoverMenuRootNode,
    PopoverMenuBarNode,
] as NodeClass[];

const CONTAINER_NODES = [
    ActionBarNode,
    FlowBoxNode,
    ListBoxNode,
    DropDownNode,
    GridNode,
    OverlayNode,
    ColumnViewNode,
    ListViewNode,
    NotebookNode,
    StackNode,
] as NodeClass[];

const NODE_CLASSES = [RootNode, ...VIRTUAL_NODES, ...SPECIALIZED_NODES, ...CONTAINER_NODES, WidgetNode] as NodeClass[];

/**
 * Creates a Node instance for the given JSX element type.
 * Matches the type against registered node classes and initializes with props.
 */
export const createNode = (
    type: string,
    props: Props,
    existingWidget?: Gtk.Widget | typeof ROOT_NODE_CONTAINER,
): Node => {
    for (const NodeClass of NODE_CLASSES) {
        if (NodeClass.matches(type, existingWidget)) {
            const node = new NodeClass(type, existingWidget);
            node.initialize(props);
            return node;
        }
    }

    throw new Error(`No matching node class for type: ${type}`);
};

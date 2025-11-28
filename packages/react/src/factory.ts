import * as Gtk from "@gtkx/ffi/gtk";
import { CONSTRUCTOR_PARAMS } from "./generated/jsx.js";
import type { Node } from "./node.js";
import { ActionBarNode } from "./nodes/action-bar.js";
import { DialogNode } from "./nodes/dialog.js";
import { DropDownItemNode, DropDownNode } from "./nodes/dropdown.js";
import { GridChildNode, GridNode } from "./nodes/grid.js";
import { ListItemNode, ListViewNode } from "./nodes/list.js";
import { NotebookNode } from "./nodes/notebook.js";
import { OverlayNode } from "./nodes/overlay.js";
import { SlotNode } from "./nodes/slot.js";
import { WidgetNode } from "./nodes/widget.js";

export type Props = Record<string, unknown>;

type WidgetConstructor = new (...args: unknown[]) => Gtk.Widget;

type AnyNodeClass = {
    needsWidget: boolean;
    matches(type: string, widget: Gtk.Widget | null): boolean;
    new (type: string, widget: Gtk.Widget, props: Props): Node;
};

const NODE_CLASSES: AnyNodeClass[] = [
    SlotNode,
    ListItemNode,
    DropDownItemNode,
    DropDownNode,
    GridChildNode,
    GridNode,
    NotebookNode,
    OverlayNode,
    ActionBarNode,
    ListViewNode,
    DialogNode,
    WidgetNode,
];

const extractConstructorArgs = (type: string, props: Props): unknown[] => {
    const params = CONSTRUCTOR_PARAMS[type];
    if (!params) return [];
    return params.map((p: { name: string; hasDefault: boolean }) => props[p.name]);
};

const createWidget = (type: string, props: Props, currentApp: unknown): Gtk.Widget => {
    // biome-ignore lint/performance/noDynamicNamespaceImportAccess: dynamic widget creation
    const WidgetClass = Gtk[type as keyof typeof Gtk] as WidgetConstructor | undefined;

    if (!WidgetClass) throw new Error(`Unknown GTK widget type: ${type}`);

    if (type === "ApplicationWindow") {
        return new WidgetClass(currentApp);
    }

    const args = extractConstructorArgs(type, props);
    return new WidgetClass(...args);
};

const normalizeType = (type: string): string => (type.endsWith(".Root") ? type.slice(0, -5) : type);

/**
 * Creates a Node instance for a given React element type.
 * Maps React element types to appropriate GTK widgets and node handlers.
 */
export const createNode = (type: string, props: Props, currentApp: unknown): Node => {
    const normalizedType = normalizeType(type);

    let widget: Gtk.Widget | null = null;

    for (const NodeClass of NODE_CLASSES) {
        if (NodeClass.needsWidget && !widget) {
            widget = createWidget(normalizedType, props, currentApp);
        }

        if (NodeClass.matches(type, widget)) {
            const node = new NodeClass(type, widget as Gtk.Widget, props);
            if (NodeClass.needsWidget) {
                node.updateProps({}, props);
            }
            return node;
        }
    }

    throw new Error(`No matching node class for type: ${type}`);
};

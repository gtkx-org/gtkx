import * as gtk from "@gtkx/ffi/gtk";
import type { Node } from "./node.js";
import { DialogNode } from "./nodes/dialog.js";
import { DropDownItemNode, DropDownNode } from "./nodes/dropdown.js";
import { GridChildNode, GridNode } from "./nodes/grid.js";
import { ListItemNode } from "./nodes/list.js";
import { SlotNode } from "./nodes/slot.js";
import { WidgetNode } from "./nodes/widget.js";

/** Props type for React elements representing GTK widgets. */
export type Props = Record<string, unknown>;

const DEFAULT_PROPS: Record<string, Props> = {
    Box: { orientation: gtk.Orientation.VERTICAL, spacing: 0 },
    Separator: { orientation: gtk.Orientation.HORIZONTAL },
    Paned: { orientation: gtk.Orientation.HORIZONTAL },
    Scale: { orientation: gtk.Orientation.HORIZONTAL, adjustment: null },
    SpinButton: { adjustment: null, climbRate: 1.0, digits: 0 },
    LinkButton: { uri: "about:blank" },
};

type WidgetConstructor = new (...args: unknown[]) => gtk.Widget;

const CONSTRUCTOR_ARGS: Record<string, (props: Props, currentApp?: unknown) => unknown[]> = {
    ApplicationWindow: (_props, app) => [app],
    Box: (props) => [undefined, props.orientation, props.spacing ?? 0],
    Separator: (props) => [props.orientation],
    Paned: (props) => [props.orientation],
    Scale: (props) => [props.orientation, props.adjustment],
    SpinButton: (props) => [props.adjustment, props.climbRate, props.digits],
    LinkButton: (props) => [props.uri],
};

type NodeClass = {
    needsWidget: boolean;
    matches(type: string): boolean;
    new (type: string, widget: gtk.Widget, props: Props): Node;
};

const NODE_CLASSES: NodeClass[] = [
    SlotNode,
    ListItemNode,
    DropDownItemNode,
    DropDownNode,
    GridChildNode,
    GridNode,
    DialogNode,
    WidgetNode,
];

const createWidget = (type: string, props: Props, currentApp: unknown): gtk.Widget => {
    // biome-ignore lint/performance/noDynamicNamespaceImportAccess: dynamic widget creation
    const WidgetClass = gtk[type as keyof typeof gtk] as WidgetConstructor | undefined;

    if (!WidgetClass) throw new Error(`Unknown GTK widget type: ${type}`);

    const argsFn = CONSTRUCTOR_ARGS[type];
    if (argsFn) {
        const args = argsFn(props, currentApp);
        return new WidgetClass(...args);
    }

    return new WidgetClass();
};

const normalizeType = (type: string): string => (type.endsWith(".Root") ? type.slice(0, -5) : type);

const applyDefaultProps = (type: string, props: Props): Props => ({
    ...DEFAULT_PROPS[type],
    ...props,
});

/**
 * Creates a Node instance for a given React element type.
 * Maps React element types to appropriate GTK widgets and node handlers.
 * @param type - The React element type (e.g., "Button", "Box.Root")
 * @param props - The element props
 * @param currentApp - The GTK Application pointer
 * @returns A Node instance for the reconciler
 */
export const createNode = (type: string, props: Props, currentApp: unknown): Node => {
    const normalizedType = normalizeType(type);
    const finalProps = applyDefaultProps(normalizedType, props);

    let widget: gtk.Widget | null = null;

    for (const NodeClass of NODE_CLASSES) {
        if (NodeClass.needsWidget && !widget) {
            widget = createWidget(normalizedType, finalProps, currentApp);
        }

        if (NodeClass.matches(type)) {
            const node = new NodeClass(type, widget as gtk.Widget, finalProps);
            if (NodeClass.needsWidget) {
                node.updateProps({}, finalProps);
            }
            return node;
        }
    }

    throw new Error(`No matching node class for type: ${type}`);
};

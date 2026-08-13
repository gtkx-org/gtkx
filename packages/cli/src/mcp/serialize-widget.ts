import type * as Gtk from "@gtkx/gi/gtk";
import { DEFAULT_SUBTREE_DEPTH, MAX_SUBTREE_WIDGETS, type SerializedWidget } from "@gtkx/mcp/internal";

type WidgetIdResolver = (widget: Gtk.Widget) => string;

type WidgetFormatting = {
    formatRole(role: Gtk.AccessibleRole): string;
    getTypeTag(widget: Gtk.Widget): string;
    getWidgetText(widget: Gtk.Widget): string | null;
};

type PendingWidget = {
    depth: number;
    node: SerializedWidget;
    widget: Gtk.Widget;
};

type Expansion = {
    budget: number;
    maxDepth: number;
    pending: PendingWidget[];
    resolveId: WidgetIdResolver;
    testing: WidgetFormatting;
};

const getChildren = (widget: Gtk.Widget): Gtk.Widget[] => {
    const children: Gtk.Widget[] = [];
    let child = widget.getFirstChild();

    while (child) {
        children.push(child);
        child = child.getNextSibling();
    }

    return children;
};

const createNode = (widget: Gtk.Widget, expansion: Expansion): SerializedWidget => ({
    id: expansion.resolveId(widget),
    type: expansion.testing.getTypeTag(widget),
    role: expansion.testing.formatRole(widget.getAccessibleRole()),
    name: widget.getName() || null,
    text: expansion.testing.getWidgetText(widget),
    isSensitive: widget.getSensitive(),
    isVisible: widget.getVisible(),
    cssClasses: widget.getCssClasses(),
    children: [],
});

const expandNode = (expansion: Expansion, parent: PendingWidget): void => {
    const children = getChildren(parent.widget);
    const canDescend = parent.depth < expansion.maxDepth;
    const shownCount = canDescend ? Math.min(children.length, expansion.budget) : 0;
    expansion.budget -= shownCount;

    for (const child of children.slice(0, shownCount)) {
        const node = createNode(child, expansion);
        parent.node.children.push(node);
        expansion.pending.push({ depth: parent.depth + 1, node, widget: child });
    }

    if (shownCount < children.length) {
        parent.node.hiddenChildren = children.length - shownCount;
    }
};

const serializeWidget = (
    widget: Gtk.Widget,
    resolveId: WidgetIdResolver,
    testing: WidgetFormatting,
    maxDepth = DEFAULT_SUBTREE_DEPTH,
): SerializedWidget => {
    const expansion: Expansion = {
        budget: MAX_SUBTREE_WIDGETS - 1,
        maxDepth,
        pending: [],
        resolveId,
        testing,
    };

    const root = createNode(widget, expansion);
    let parent: PendingWidget | undefined = { depth: 0, node: root, widget };

    while (parent !== undefined) {
        expandNode(expansion, parent);
        parent = expansion.pending.shift();
    }

    return root;
};

export { serializeWidget };

/// <reference types="@gtkx/config/env" />

import { META_OBJECT_ADD_METHODS, PAGE_META_SETTERS } from "virtual:gtkx-config";
import {
    type AddMethodRule,
    CONTAINER_SLOT_KIND,
    LAYOUT_CHILD_KIND,
    META_OBJECT_KIND,
    OVERLAY_KIND,
    TAB_LABEL_KIND,
    WIDGET_PROP_KIND,
} from "@gtkx/config";
import * as GObject from "@gtkx/gi/gobject";
import * as Graphene from "@gtkx/gi/graphene";
import * as Gsk from "@gtkx/gi/gsk";
import * as Gtk from "@gtkx/gi/gtk";
import { callMethod, callRequiredMethod } from "@gtkx/utils";
import { collectTypeNameChain, findInheritedRow } from "../utils/gtype.js";
import {
    attachToParent,
    childRuleSetMapping,
    type ElementMapping,
    orderedInsertMapping,
    setElementMap,
} from "./dispatch.js";
import {
    type InsertableWidget,
    isAddable,
    isAppendable,
    isInsertable,
    isRemovable,
    isReorderable,
    isSingleChild,
    isSingleChildContainer,
    type ReorderableWidget,
} from "./predicates.js";
import {
    childWidget,
    isToplevel,
    relationshipChildInstances,
    relationshipChildWidgets,
    trackedInstance,
    trackedWidget,
} from "./relationship-content.js";
import { namedRuleSet, RULE_CONTEXT, resolveAppendRuleSet, ruleNodeOf } from "./rule-registry.js";
import { SLOT_HOST_BASE_TYPE } from "./slot-props.js";
import { isRelationshipKind, type Node, stateOf } from "./state.js";
import type { Props } from "./types.js";
import { attachChild, detachChild, getFocusWidget, isAttachedTo, isDescendantOf, unparentWidget } from "./widget.js";

const isRooted = (instance: GObject.Object): boolean =>
    instance instanceof Gtk.Widget ? instance.getRoot() !== null : true;

const rescueFocus = (parent: GObject.Object, child: GObject.Object | undefined): void => {
    if (!(parent instanceof Gtk.Widget) || !(child instanceof Gtk.Widget)) return;
    const focus = getFocusWidget(child);
    if (focus && isDescendantOf(focus, child)) parent.grabFocus();
};

type WidgetPropState = { prop: string; value: GObject.Object };

const widgetPropState = new WeakMap<Node, WidgetPropState>();

const LAYOUT_MANAGER_PROP = "layoutManager";

const resyncLayoutChildWrappers = (parent: Node): void => {
    for (const sibling of stateOf(parent).children) {
        if (isRelationshipKind(sibling, LAYOUT_CHILD_KIND)) attachToParent(sibling, parent);
    }
};

const widgetPropMapping: ElementMapping = {
    matches: (child, parent) => isRelationshipKind(child, WIDGET_PROP_KIND) && parent instanceof GObject.Object,
    attach: (child, parent) => {
        const childState = stateOf(child);
        const prop = childState.props.propName;
        if (typeof prop !== "string" || !(parent instanceof GObject.Object)) return;
        const value = trackedInstance(child);
        const state = widgetPropState.get(child);
        if (state && state.value === value) return;
        Reflect.set(parent, prop, value ?? null);
        if (value) widgetPropState.set(child, { prop, value });
        else widgetPropState.delete(child);
        if (prop === LAYOUT_MANAGER_PROP) resyncLayoutChildWrappers(parent);
    },
    detach: (child, parent) => {
        const state = widgetPropState.get(child);
        widgetPropState.delete(child);
        if (!state || !(parent instanceof GObject.Object) || !isRooted(parent)) return;
        rescueFocus(parent, state.value);
        Reflect.set(parent, state.prop, null);
    },
};

const sameInstances = (a: Node[], b: Node[]): boolean =>
    a.length === b.length && a.every((instance, index) => instance === b[index]);

const slotTagOf = (node: Node): string | undefined => {
    const slotTag = stateOf(node).props.slotTag;
    return typeof slotTag === "string" ? slotTag : undefined;
};

const slotHostRuleSet = (host: GObject.Object, slotTag: string) => {
    const baseType = SLOT_HOST_BASE_TYPE[slotTag];
    return baseType ? namedRuleSet(baseType) : resolveAppendRuleSet(host.__type__);
};

const attachContainerSlotChild = (instance: Node, parent: GObject.Object, slotTag: string): void => {
    const parentNode = ruleNodeOf(parent);
    const childNode = ruleNodeOf(instance, slotTag);
    if (parentNode && childNode) slotHostRuleSet(parent, slotTag)?.appendChild?.(parentNode, childNode, RULE_CONTEXT);
};

const detachContainerSlotChild = (instance: Node, parent: GObject.Object, slotTag: string): void => {
    const parentNode = ruleNodeOf(parent);
    const childNode = ruleNodeOf(instance, slotTag);
    if (parentNode && childNode) slotHostRuleSet(parent, slotTag)?.removeChild?.(parentNode, childNode, RULE_CONTEXT);
    if (instance instanceof Gtk.Widget && instance.getParent() !== null) unparentWidget(instance);
};

const containerSlotState = new WeakMap<Node, Node[]>();

const containerSlotMapping: ElementMapping = {
    matches: (child, parent) => isRelationshipKind(child, CONTAINER_SLOT_KIND) && parent instanceof GObject.Object,
    attach: (child, parent) => {
        const slotTag = slotTagOf(child);
        if (slotTag === undefined || !(parent instanceof GObject.Object)) return;
        const desired = relationshipChildInstances(child);
        const prev = containerSlotState.get(child) ?? [];
        if (sameInstances(prev, desired)) return;
        for (const instance of prev) detachContainerSlotChild(instance, parent, slotTag);
        for (const instance of desired) attachContainerSlotChild(instance, parent, slotTag);
        containerSlotState.set(child, desired);
    },
    detach: (child, parent) => {
        const slotTag = slotTagOf(child);
        const instances = containerSlotState.get(child) ?? [];
        containerSlotState.delete(child);
        if (slotTag === undefined || !(parent instanceof GObject.Object)) return;
        for (const instance of instances) detachContainerSlotChild(instance, parent, slotTag);
    },
};

const applyPageMeta = (page: object, props: Props): void => {
    for (const { setter, prop, fallback, whenPresent } of PAGE_META_SETTERS) {
        if (typeof Reflect.get(page, setter) !== "function") continue;
        if (whenPresent && props[prop] === undefined) continue;
        callRequiredMethod(page, setter, [props[prop] ?? fallback]);
    }
};

type MetaState = { widget: Gtk.Widget; page: object };

const metaAddRules = (target: GObject.Object | undefined): AddMethodRule[] | null => {
    if (!target) return null;
    return findInheritedRow(target.__type__, META_OBJECT_ADD_METHODS) ?? null;
};

const pagePropValue = (props: Props, key: string): string | null =>
    typeof props[key] === "string" ? (props[key] as string) : null;

const addStackPage = (
    stack: GObject.Object,
    rules: AddMethodRule[],
    widget: Gtk.Widget,
    props: Props,
): object | undefined => {
    for (const rule of rules) {
        if (!rule.requires.every((key) => pagePropValue(props, key) !== null)) continue;
        const args = rule.args.map((arg) => (arg === "widget" ? widget : pagePropValue(props, arg)));
        const page = callRequiredMethod(stack, rule.method, args);
        return typeof page === "object" && page !== null ? page : undefined;
    }
    return undefined;
};

const notebookPosition = (node: Node): number | null => {
    const parent = stateOf(node).parent;
    const siblings = parent
        ? stateOf(parent).children.filter((child) => isRelationshipKind(child, META_OBJECT_KIND))
        : [];
    const index = siblings.indexOf(node);
    return index >= 0 ? index : null;
};

const notebookTabLabel = (node: Node): Gtk.Widget => {
    const nodeState = stateOf(node);
    const tab = nodeState.children.find((child) => isRelationshipKind(child, TAB_LABEL_KIND));
    const label = tab ? stateOf(tab).children[0] : undefined;
    if (label instanceof Gtk.Widget) return label;
    const synthesized = new Gtk.Label();
    synthesized.setLabel(typeof nodeState.props.label === "string" ? nodeState.props.label : "");
    return synthesized;
};

const applyNotebookMeta = (notebook: Gtk.Notebook, widget: Gtk.Widget, props: Props): void => {
    const page = notebook.getPage(widget);
    if (!page) return;
    if (props.tabExpand !== undefined) Reflect.set(page, "tabExpand", props.tabExpand);
    if (props.tabFill !== undefined) Reflect.set(page, "tabFill", props.tabFill);
};

const updateNotebookTabLabel = (notebook: Gtk.Notebook, widget: Gtk.Widget, node: Node): void => {
    const nodeState = stateOf(node);
    if (nodeState.children.some((child) => isRelationshipKind(child, TAB_LABEL_KIND))) return;
    const current = notebook.getTabLabel(widget);
    if (current instanceof Gtk.Label)
        current.setLabel(typeof nodeState.props.label === "string" ? nodeState.props.label : "");
};

const attachNotebookPage = (notebook: Gtk.Notebook, widget: Gtk.Widget, node: Node): void => {
    const label = notebookTabLabel(node);
    const position = notebookPosition(node);
    if (position == null) notebook.appendPage(widget, label);
    else notebook.insertPage(widget, label, position);
    applyNotebookMeta(notebook, widget, stateOf(node).props);
};

type NotebookPageState = { widget: Gtk.Widget };

const notebookPageState = new WeakMap<Node, NotebookPageState>();

const notebookPageMapping: ElementMapping = {
    matches: (child, parent) => isRelationshipKind(child, META_OBJECT_KIND) && parent instanceof Gtk.Notebook,
    attach: (child, parent) => {
        if (!(parent instanceof Gtk.Notebook)) return;
        const widget = trackedWidget(child);
        const state = notebookPageState.get(child);
        if (state && state.widget === widget) {
            updateNotebookTabLabel(parent, state.widget, child);
            applyNotebookMeta(parent, state.widget, stateOf(child).props);
            return;
        }
        if (state) notebookPageMapping.detach(child, parent);
        if (!widget) return;
        attachNotebookPage(parent, widget, child);
        notebookPageState.set(child, { widget });
    },
    detach: (child, parent) => {
        if (!(parent instanceof Gtk.Notebook)) return;
        const state = notebookPageState.get(child);
        notebookPageState.delete(child);
        if (!state) return;
        const pageNum = parent.pageNum(state.widget);
        if (pageNum !== -1) parent.removePage(pageNum);
    },
};

const metaState = new WeakMap<Node, MetaState>();

const metaObjectMapping: ElementMapping = {
    matches: (child, parent) =>
        isRelationshipKind(child, META_OBJECT_KIND) &&
        metaAddRules(parent instanceof GObject.Object ? parent : undefined) !== null,
    attach: (child, parent) => {
        const childState = stateOf(child);
        const widget = trackedWidget(child);
        const state = metaState.get(child);
        if (state && state.widget === widget) {
            applyPageMeta(state.page, childState.props);
            return;
        }
        if (state) metaObjectMapping.detach(child, parent);
        if (!widget) return;
        const target = parent instanceof GObject.Object ? parent : undefined;
        const rules = metaAddRules(target);
        if (!target || !rules) return;
        const page = addStackPage(target, rules, widget, childState.props);
        if (!page) return;
        applyPageMeta(page, childState.props);
        metaState.set(child, { widget, page });
    },
    detach: (child, parent) => {
        const state = metaState.get(child);
        metaState.delete(child);
        if (!state) return;
        if (parent instanceof Gtk.Widget && metaAddRules(parent) !== null && isAttachedTo(state.widget, parent)) {
            callMethod(parent, "remove", [state.widget]);
        }
    },
};

const resolveLayoutKind = (parent: GObject.Object): "grid" | "fixed" | null => {
    if (parent instanceof Gtk.Grid) return "grid";
    if (parent instanceof Gtk.Fixed) return "fixed";
    if (parent instanceof Gtk.Widget) {
        const layout = parent.getLayoutManager();
        if (layout instanceof Gtk.GridLayout) return "grid";
        if (layout instanceof Gtk.FixedLayout) return "fixed";
    }
    return null;
};

const buildFixedTransform = (props: Props): Gsk.Transform | null => {
    const point = new Graphene.Point();
    point.init(typeof props.x === "number" ? props.x : 0, typeof props.y === "number" ? props.y : 0);
    let value: Gsk.Transform | null = Gsk.Transform.new().translate(point);
    if (props.transform instanceof Gsk.Transform && value) value = value.transform(props.transform);
    return value;
};

const applyGridLayoutChild = (layoutChild: Gtk.LayoutChild, props: Props): void => {
    if ("column" in layoutChild) Reflect.set(layoutChild, "column", props.column ?? 0);
    if ("row" in layoutChild) Reflect.set(layoutChild, "row", props.row ?? 0);
    if ("columnSpan" in layoutChild) Reflect.set(layoutChild, "columnSpan", props.columnSpan ?? 1);
    if ("rowSpan" in layoutChild) Reflect.set(layoutChild, "rowSpan", props.rowSpan ?? 1);
};

const applyFixedLayoutChild = (layoutChild: Gtk.LayoutChild, props: Props): void => {
    if (typeof Reflect.get(layoutChild, "setTransform") !== "function") return;
    const value = buildFixedTransform(props);
    if (value) callRequiredMethod(layoutChild, "setTransform", [value]);
};

const applyLayoutChild = (parent: Gtk.Widget, widget: Gtk.Widget, kind: "grid" | "fixed", props: Props): void => {
    const layout = parent.getLayoutManager();
    if (!layout) return;
    const layoutChild = layout.getLayoutChild(widget);
    if (kind === "grid") applyGridLayoutChild(layoutChild, props);
    else applyFixedLayoutChild(layoutChild, props);
};

const multiChildState = new WeakMap<Node, Gtk.Widget[]>();

type MultiChildHandlers = {
    remove: (widget: Gtk.Widget) => void;
    add: (widget: Gtk.Widget) => void;
    applyChild: (widget: Gtk.Widget, props: Props) => void;
};

const reconcileMultiChildAttach = (child: Node, parent: Gtk.Widget, handlers: MultiChildHandlers): void => {
    const { remove, add, applyChild } = handlers;
    const childState = stateOf(child);
    const desired = relationshipChildWidgets(child);
    const prev = multiChildState.get(child) ?? [];
    for (const widget of prev) {
        if (!desired.includes(widget)) remove(widget);
    }
    for (const widget of desired) {
        if (widget.getParent() !== parent) add(widget);
        applyChild(widget, childState.props);
    }
    multiChildState.set(child, desired);
};

const reconcileMultiChildDetach = (child: Node, remove: (widget: Gtk.Widget) => void): void => {
    for (const widget of multiChildState.get(child) ?? []) {
        remove(widget);
    }
    multiChildState.delete(child);
};

const layoutChildMapping: ElementMapping = {
    matches: (child, parent) =>
        isRelationshipKind(child, LAYOUT_CHILD_KIND) &&
        parent instanceof Gtk.Widget &&
        resolveLayoutKind(parent) !== null,
    attach: (child, parent) => {
        if (!(parent instanceof Gtk.Widget)) return;
        const kind = resolveLayoutKind(parent);
        if (!kind) return;
        reconcileMultiChildAttach(child, parent, {
            remove: (widget) => detachChild(widget, parent),
            add: (widget) => attachChild(widget, parent),
            applyChild: (widget, props) => applyLayoutChild(parent, widget, kind, props),
        });
    },
    detach: (child, parent) => {
        reconcileMultiChildDetach(child, (widget) => {
            if (parent instanceof Gtk.Widget) detachChild(widget, parent);
        });
    },
};

const applyOverlayFlags = (overlay: Gtk.Overlay, widget: Gtk.Widget, props: Props): void => {
    overlay.setMeasureOverlay(widget, props.measure === true);
    overlay.setClipOverlay(widget, props.clipOverlay === true);
};

const overlayMapping: ElementMapping = {
    matches: (child, parent) => isRelationshipKind(child, OVERLAY_KIND) && parent instanceof Gtk.Overlay,
    attach: (child, parent) => {
        if (!(parent instanceof Gtk.Overlay)) return;
        reconcileMultiChildAttach(child, parent, {
            remove: (widget) => {
                if (widget.getParent() === parent) parent.removeOverlay(widget);
            },
            add: (widget) => parent.addOverlay(widget),
            applyChild: (widget, props) => applyOverlayFlags(parent, widget, props),
        });
    },
    detach: (child, parent) => {
        reconcileMultiChildDetach(child, (widget) => {
            if (parent instanceof Gtk.Overlay && widget.getParent() === parent) parent.removeOverlay(widget);
            else if (widget instanceof Gtk.Widget) unparentWidget(widget);
        });
    },
};

const toplevelSkipMapping: ElementMapping = {
    matches: (child) => isToplevel(child),
    attach: () => {},
    detach: () => {},
};

const listItemChildMapping: ElementMapping = {
    matches: (child, parent) =>
        child instanceof Gtk.Widget && !(parent instanceof Gtk.Widget) && isSingleChildContainer(parent),
    attach: (child, parent, _anchor, fresh) => {
        if (child instanceof Gtk.Widget && isSingleChildContainer(parent)) {
            if (fresh !== true) unparentWidget(child);
            parent.setChild(child);
        }
    },
    detach: (child, parent) => {
        if (child instanceof Gtk.Widget && isSingleChildContainer(parent) && parent.getChild() === child) {
            parent.setChild(null);
        }
    },
};

const isAutowrap = (container: Gtk.Widget, widget: Gtk.Widget): boolean =>
    (container instanceof Gtk.ListBox || container instanceof Gtk.FlowBox) &&
    !(widget instanceof Gtk.ListBoxRow || widget instanceof Gtk.FlowBoxChild);

const detachAutowrapped = (widget: Gtk.Widget): void => {
    const wrapper = widget.getParent();
    if (wrapper && isSingleChild(wrapper)) {
        wrapper.setChild(null);
        const wrapperParent = wrapper.getParent();
        if (wrapperParent && isRemovable(wrapperParent)) wrapperParent.remove(wrapper);
    }
};

function* gtkChildren(container: Gtk.Widget): IterableIterator<Gtk.Widget> {
    let child = container.getFirstChild();
    while (child) {
        yield child;
        child = child.getNextSibling();
    }
}

const appendWidget = (container: Gtk.Widget, widget: Gtk.Widget, fresh: boolean): void => {
    if (!fresh && (isAppendable(container) || isAddable(container))) {
        if (isAutowrap(container, widget)) detachAutowrapped(widget);
        else unparentWidget(widget);
    }
    attachChild(widget, container);
};

const unwrapGtkChild = (child: Gtk.Widget): Gtk.Widget | null => {
    if ("getChild" in child && typeof child.getChild === "function") {
        const inner: unknown = child.getChild();
        return inner instanceof Gtk.Widget ? inner : null;
    }
    return child;
};

const findAutowrappedPosition = (container: Gtk.Widget, before: Gtk.Widget): number | null => {
    const beforeIsRow = before instanceof Gtk.ListBoxRow || before instanceof Gtk.FlowBoxChild;
    let position = 0;
    for (const current of gtkChildren(container)) {
        const compare = beforeIsRow ? current : unwrapGtkChild(current);
        if (compare && compare === before) return position;
        position++;
    }
    return null;
};

const insertAutowrapping = (container: Gtk.ListBox | Gtk.FlowBox, widget: Gtk.Widget, before: Gtk.Widget): void => {
    const currentParent = widget.getParent();
    if (currentParent !== null) {
        if (widget instanceof Gtk.ListBoxRow || widget instanceof Gtk.FlowBoxChild) {
            if (isRemovable(currentParent)) currentParent.remove(widget);
        } else {
            detachAutowrapped(widget);
        }
    }
    const position = findAutowrappedPosition(container, before);
    if (position === null) container.append(widget);
    else container.insert(widget, position);
};

const findPrevSibling = (container: Gtk.Widget, before: Gtk.Widget): Gtk.Widget | undefined => {
    for (const child of gtkChildren(container)) {
        if (child === before) return child.getPrevSibling() ?? undefined;
    }
    return undefined;
};

const insertReorderable = (container: ReorderableWidget, widget: Gtk.Widget, before: Gtk.Widget): void => {
    const previous = findPrevSibling(container, before);
    if (widget.getParent() === container) container.reorderChildAfter(widget, previous);
    else {
        unparentWidget(widget);
        container.insertChildAfter(widget, previous);
    }
};

const findInsertPosition = (container: Gtk.Widget, before: Gtk.Widget): number => {
    let position = 0;
    for (const current of gtkChildren(container)) {
        if (current === before) return position;
        position++;
    }
    return position;
};

const insertInsertable = (container: InsertableWidget, widget: Gtk.Widget, before: Gtk.Widget): void => {
    unparentWidget(widget);
    container.insert(widget, findInsertPosition(container, before));
};

const reinsertAll = (parent: Node, container: Gtk.Widget): void => {
    const widgets: Gtk.Widget[] = [];
    for (const child of stateOf(parent).children) {
        const widget = childWidget(child);
        if (widget) widgets.push(widget);
    }
    for (const widget of widgets) detachChild(widget, container);
    for (const widget of widgets) attachChild(widget, container);
};

const insertWidgetBefore = (parent: Node, container: Gtk.Widget, widget: Gtk.Widget, anchor: Gtk.Widget): void => {
    if (container instanceof Gtk.ListBox || container instanceof Gtk.FlowBox) {
        insertAutowrapping(container, widget, anchor);
    } else if (isReorderable(container)) {
        insertReorderable(container, widget, anchor);
    } else if (isInsertable(container)) {
        insertInsertable(container, widget, anchor);
    } else {
        reinsertAll(parent, container);
    }
};

const removeWidget = (container: Gtk.Widget, widget: Gtk.Widget): void => {
    if (!isAutowrap(container, widget)) {
        detachChild(widget, container);
        return;
    }
    const wrapper = widget.getParent();
    if (wrapper && isSingleChild(wrapper)) {
        wrapper.setChild(null);
        if (isRemovable(container)) container.remove(wrapper);
    }
};

const widgetContainerMapping: ElementMapping = {
    matches: (child, parent) => childWidget(child) !== null && parent instanceof Gtk.Widget,
    attach: (child, parent, anchor, fresh) => {
        const widget = childWidget(child);
        if (!(parent instanceof Gtk.Widget) || !widget) return;
        if (anchor instanceof Gtk.Widget) insertWidgetBefore(parent, parent, widget, anchor);
        else appendWidget(parent, widget, fresh === true);
    },
    detach: (child, parent) => {
        const widget = childWidget(child);
        if (parent instanceof Gtk.Widget && widget) removeWidget(parent, widget);
    },
};

type PromotedChildTarget = {
    matchesChild: (child: GObject.Object) => boolean;
    acceptsParent: (parent: GObject.Object, child: GObject.Object) => boolean;
    prop: string;
};

const PROMOTED_CHILD_TARGETS: PromotedChildTarget[] = [
    {
        matchesChild: (child) => child instanceof Gtk.EventController,
        acceptsParent: (parent) => parent instanceof Gtk.Widget,
        prop: "controllers",
    },
    {
        matchesChild: (child) => child instanceof Gtk.LayoutManager,
        acceptsParent: (parent) => parent instanceof Gtk.Widget,
        prop: "layoutManager",
    },
    {
        matchesChild: (child) => child instanceof Gtk.Shortcut,
        acceptsParent: (parent) => parent instanceof Gtk.ShortcutController,
        prop: "shortcuts",
    },
    {
        matchesChild: (child) => child instanceof Gtk.TextBuffer,
        acceptsParent: (parent) => parent instanceof Gtk.TextView,
        prop: "buffer",
    },
];

const promotedTargetFor = (child: Node, parent: Node): PromotedChildTarget | null => {
    if (!(child instanceof GObject.Object) || !(parent instanceof GObject.Object)) return null;
    for (const target of PROMOTED_CHILD_TARGETS) {
        if (target.matchesChild(child) && !target.acceptsParent(parent, child)) return target;
    }
    return null;
};

const displayName = (node: Node): string => {
    const state = stateOf(node);
    if (node instanceof GObject.Object) return collectTypeNameChain(node.__type__)[0] ?? state.name ?? "GObject";
    return state.name ?? state.kind ?? "node";
};

const promotedNestingGuardMapping: ElementMapping = {
    matches: (child, parent) => promotedTargetFor(child, parent) !== null,
    attach: (child, parent) => {
        const target = promotedTargetFor(child, parent);
        throw new Error(
            `<${displayName(child)}> cannot be a child of <${displayName(parent)}>: pass it through the \`${target?.prop}\` prop instead.`,
        );
    },
    detach: () => {},
};

const ELEMENT_MAP: ElementMapping[] = [
    widgetPropMapping,
    containerSlotMapping,
    notebookPageMapping,
    metaObjectMapping,
    layoutChildMapping,
    overlayMapping,
    promotedNestingGuardMapping,
    orderedInsertMapping,
    childRuleSetMapping,
    toplevelSkipMapping,
    listItemChildMapping,
    widgetContainerMapping,
];

setElementMap(ELEMENT_MAP);

export { attachNode, detachFromParent, detachNode, resyncRelationshipNode } from "./dispatch.js";

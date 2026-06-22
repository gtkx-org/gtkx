/// <reference types="@gtkx/config/env" />

import { META_OBJECT_ADD_METHODS, PAGE_META_SETTERS } from "virtual:gtkx-config";
import {
    type AddMethodRule,
    CONTAINER_PROP_KIND,
    type ContainerPropRow,
    LAYOUT_CHILD_KIND,
    META_OBJECT_KIND,
    OVERLAY_KIND,
    SLOT_KIND,
    TAB_LABEL_KIND,
    type VerbArgs,
} from "@gtkx/config";
import * as GObject from "@gtkx/gi/gobject";
import * as Graphene from "@gtkx/gi/graphene";
import * as Gsk from "@gtkx/gi/gsk";
import * as Gtk from "@gtkx/gi/gtk";
import { findInheritedRow } from "../utils/gtype.js";
import {
    callVerb,
    DATA_ATTACH_MAPPINGS,
    guardHolds,
    promotedNestingGuardMapping,
    resolveArgs,
} from "./attach-rules.js";
import type { ElementMapping } from "./element-mapping.js";
import { attachToParent, setElementMap } from "./mappings/dispatch.js";
import {
    childWidget,
    isTopLevel,
    trackedInstance,
    trackedWidget,
    wrapperChildWidgets,
} from "./mappings/wrapper-content.js";
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
import { callMethod, invokeRequiredMethod } from "./reflect-call.js";
import { isWrapperKind, type Node, stateOf } from "./state.js";
import type { Props } from "./types.js";
import { attachChild, detachChild, getFocusWidget, isAttachedTo, isDescendantOf, unparentWidget } from "./widget.js";

const isRooted = (instance: GObject.Object): boolean =>
    instance instanceof Gtk.Widget ? instance.getRoot() !== null : true;

const rescueFocus = (parent: GObject.Object, child: GObject.Object | undefined): void => {
    if (!(parent instanceof Gtk.Widget) || !(child instanceof Gtk.Widget)) return;
    const focus = getFocusWidget(child);
    if (focus && isDescendantOf(focus, child)) parent.grabFocus();
};

type SlotState = { prop: string; value: GObject.Object };

const slotState = new WeakMap<Node, SlotState>();

const LAYOUT_MANAGER_PROP = "layoutManager";

const resyncLayoutChildWrappers = (parent: Node): void => {
    for (const sibling of stateOf(parent).children) {
        if (isWrapperKind(sibling, LAYOUT_CHILD_KIND)) attachToParent(sibling, parent);
    }
};

const slotMapping: ElementMapping = {
    matches: (child, parent) => isWrapperKind(child, SLOT_KIND) && parent instanceof GObject.Object,
    attach: (child, parent) => {
        const childState = stateOf(child);
        const prop = childState.props["propName"];
        if (typeof prop !== "string" || !(parent instanceof GObject.Object)) return;
        const value = trackedInstance(child);
        const state = slotState.get(child);
        if (state && state.value === value) return;
        Reflect.set(parent, prop, value ?? null);
        if (value) slotState.set(child, { prop, value });
        else slotState.delete(child);
        if (prop === LAYOUT_MANAGER_PROP) resyncLayoutChildWrappers(parent);
    },
    detach: (child, parent) => {
        const state = slotState.get(child);
        slotState.delete(child);
        if (!state || !(parent instanceof GObject.Object) || !isRooted(parent)) return;
        rescueFocus(parent, state.value);
        Reflect.set(parent, state.prop, null);
    },
};

const wrapperChildInstances = (marker: Node): Node[] =>
    stateOf(marker).children.filter((child) => child instanceof GObject.Object);

const sameInstances = (a: Node[], b: Node[]): boolean =>
    a.length === b.length && a.every((instance, index) => instance === b[index]);

const containerArgs = (args: VerbArgs | undefined): VerbArgs => args ?? "child";

const attachContainerPropChild = (instance: Node, parent: Node, verb: ContainerPropRow): void => {
    if (!(parent instanceof GObject.Object)) return;
    const args = resolveArgs(containerArgs(verb.attachArgs), instance);
    if (args) invokeRequiredMethod(parent, verb.attach, args);
};

const detachContainerPropChild = (instance: Node, parent: Node, verb: ContainerPropRow): void => {
    if (!(parent instanceof GObject.Object)) return;
    if (verb.detach === undefined) {
        if (instance instanceof Gtk.Widget) unparentWidget(instance);
        return;
    }
    if (!guardHolds(verb.detachGuard, instance, parent)) return;
    const args = resolveArgs(containerArgs(verb.detachArgs), instance);
    if (args) callVerb(parent, verb.detach, args);
};

const containerPropVerb = (child: Node): ContainerPropRow | null => {
    const verb = stateOf(child).props["verb"];
    return typeof verb === "object" && verb !== null ? (verb as ContainerPropRow) : null;
};

const containerPropState = new WeakMap<Node, Node[]>();

const containerPropMapping: ElementMapping = {
    matches: (child, parent) => isWrapperKind(child, CONTAINER_PROP_KIND) && parent instanceof GObject.Object,
    attach: (child, parent) => {
        const verb = containerPropVerb(child);
        if (!verb || !(parent instanceof GObject.Object)) return;
        const desired = wrapperChildInstances(child);
        const prev = containerPropState.get(child) ?? [];
        if (sameInstances(prev, desired)) return;
        for (const instance of prev) detachContainerPropChild(instance, parent, verb);
        for (const instance of desired) attachContainerPropChild(instance, parent, verb);
        containerPropState.set(child, desired);
    },
    detach: (child, parent) => {
        const verb = containerPropVerb(child);
        const instances = containerPropState.get(child) ?? [];
        containerPropState.delete(child);
        if (!verb) return;
        for (const instance of instances) detachContainerPropChild(instance, parent, verb);
    },
};

const applyPageMeta = (page: object, props: Props): void => {
    for (const { setter, prop, fallback, whenPresent } of PAGE_META_SETTERS) {
        if (typeof Reflect.get(page, setter) !== "function") continue;
        if (whenPresent && props[prop] === undefined) continue;
        invokeRequiredMethod(page, setter, [props[prop] ?? fallback]);
    }
};

type MetaState = { widget: Gtk.Widget; page: object };

const metaAddRules = (target: GObject.Object | undefined): AddMethodRule[] | null => {
    if (!target) return null;
    return findInheritedRow(target.__gtype__, META_OBJECT_ADD_METHODS, () => true) ?? null;
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
        const page = invokeRequiredMethod(stack, rule.method, args);
        return typeof page === "object" && page !== null ? page : undefined;
    }
    return undefined;
};

const notebookPosition = (marker: Node): number | null => {
    const parent = stateOf(marker).parent;
    const siblings = parent ? stateOf(parent).children.filter((child) => isWrapperKind(child, META_OBJECT_KIND)) : [];
    const index = siblings.indexOf(marker);
    return index >= 0 ? index : null;
};

const notebookTabLabel = (marker: Node): Gtk.Widget => {
    const markerState = stateOf(marker);
    const tab = markerState.children.find((child) => isWrapperKind(child, TAB_LABEL_KIND));
    const label = tab ? stateOf(tab).children[0] : undefined;
    if (label instanceof Gtk.Widget) return label;
    const synthesized = new Gtk.Label();
    synthesized.setLabel(typeof markerState.props["label"] === "string" ? markerState.props["label"] : "");
    return synthesized;
};

const applyNotebookMeta = (notebook: Gtk.Notebook, widget: Gtk.Widget, props: Props): void => {
    const page = notebook.getPage(widget);
    if (!page) return;
    if (props["tabExpand"] !== undefined) Reflect.set(page, "tabExpand", props["tabExpand"]);
    if (props["tabFill"] !== undefined) Reflect.set(page, "tabFill", props["tabFill"]);
};

const updateNotebookTabLabel = (notebook: Gtk.Notebook, widget: Gtk.Widget, marker: Node): void => {
    const markerState = stateOf(marker);
    if (markerState.children.some((child) => isWrapperKind(child, TAB_LABEL_KIND))) return;
    const current = notebook.getTabLabel(widget);
    if (current instanceof Gtk.Label)
        current.setLabel(typeof markerState.props["label"] === "string" ? markerState.props["label"] : "");
};

const attachNotebookPage = (notebook: Gtk.Notebook, widget: Gtk.Widget, marker: Node): void => {
    const label = notebookTabLabel(marker);
    const position = notebookPosition(marker);
    if (position == null) notebook.appendPage(widget, label);
    else notebook.insertPage(widget, label, position);
    applyNotebookMeta(notebook, widget, stateOf(marker).props);
};

type NotebookPageState = { widget: Gtk.Widget };

const notebookPageState = new WeakMap<Node, NotebookPageState>();

const notebookPageMapping: ElementMapping = {
    matches: (child, parent) => isWrapperKind(child, META_OBJECT_KIND) && parent instanceof Gtk.Notebook,
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
        isWrapperKind(child, META_OBJECT_KIND) &&
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
    point.init(typeof props["x"] === "number" ? props["x"] : 0, typeof props["y"] === "number" ? props["y"] : 0);
    let value: Gsk.Transform | null = Gsk.Transform.new().translate(point);
    if (props["transform"] instanceof Gsk.Transform && value) value = value.transform(props["transform"]);
    return value;
};

const applyGridLayoutChild = (layoutChild: Gtk.LayoutChild, props: Props): void => {
    if ("column" in layoutChild) Reflect.set(layoutChild, "column", props["column"] ?? 0);
    if ("row" in layoutChild) Reflect.set(layoutChild, "row", props["row"] ?? 0);
    if ("columnSpan" in layoutChild) Reflect.set(layoutChild, "columnSpan", props["columnSpan"] ?? 1);
    if ("rowSpan" in layoutChild) Reflect.set(layoutChild, "rowSpan", props["rowSpan"] ?? 1);
};

const applyFixedLayoutChild = (layoutChild: Gtk.LayoutChild, props: Props): void => {
    if (typeof Reflect.get(layoutChild, "setTransform") !== "function") return;
    const value = buildFixedTransform(props);
    if (value) invokeRequiredMethod(layoutChild, "setTransform", [value]);
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
    const desired = wrapperChildWidgets(child);
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
        isWrapperKind(child, LAYOUT_CHILD_KIND) && parent instanceof Gtk.Widget && resolveLayoutKind(parent) !== null,
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
    overlay.setMeasureOverlay(widget, props["measure"] === true);
    overlay.setClipOverlay(widget, props["clipOverlay"] === true);
};

const overlayMapping: ElementMapping = {
    matches: (child, parent) => isWrapperKind(child, OVERLAY_KIND) && parent instanceof Gtk.Overlay,
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

const topLevelSkipMapping: ElementMapping = {
    matches: (child) => isTopLevel(child),
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

export const ELEMENT_MAP: ElementMapping[] = [
    slotMapping,
    containerPropMapping,
    notebookPageMapping,
    metaObjectMapping,
    layoutChildMapping,
    overlayMapping,
    promotedNestingGuardMapping,
    ...DATA_ATTACH_MAPPINGS,
    topLevelSkipMapping,
    listItemChildMapping,
    widgetContainerMapping,
];

setElementMap(ELEMENT_MAP);

export { attachNode, detachFromParent, detachNode, resyncWrapper } from "./mappings/dispatch.js";

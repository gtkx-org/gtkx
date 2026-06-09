/**
 * The reconciler's attach/detach table.
 *
 * Every parent→child relationship the renderer can make — a widget into a
 * container, an event controller onto a widget, a metadata wrapper's content
 * onto its grandparent — is one {@link ElementMapping} entry. The reconciler
 * iterates {@link ELEMENT_MAP} top to bottom and applies the first entry whose
 * `matches` predicate holds, so specific entries precede the generic
 * widget-container fallback. Entries are self-contained: `attach` is idempotent
 * (it may run again when a wrapper's content or metadata changes), reading the
 * child's own props/children and stashing per-attachment bookkeeping on
 * {@link Instance.attachState}.
 */
import * as Adw from "@gtkx/gi/adw";
import * as Graphene from "@gtkx/gi/graphene";
import * as Gsk from "@gtkx/gi/gsk";
import * as Gtk from "@gtkx/gi/gtk";
import { getColumnController, getColumnViewController } from "./components/internal/column-view-registry.js";
import { type Instance, isWrapperInstance, isWrapperKind } from "./instance.js";
import {
    type InsertableWidget,
    isAddable,
    isAppendable,
    isInsertable,
    isReorderable,
    isSingleChild,
    isSingleChildContainer,
    type ReorderableWidget,
} from "./nodes/internal/predicates.js";
import {
    attachChild,
    detachChild,
    getFocusWidget,
    isAttachedTo,
    isDescendantOf,
    unparentWidget,
} from "./nodes/internal/widget.js";
import type { BackingInstance } from "./types.js";

/**
 * One attach/detach rule. The reconciler applies the first entry in
 * {@link ELEMENT_MAP} whose {@link matches} holds for a `(child, parent)` pair.
 */
export interface ElementMapping {
    /** Whether this mapping governs attaching `child` to `parent`. */
    matches(child: Instance, parent: Instance): boolean;
    /**
     * Attaches `child` to `parent`. Idempotent: re-invoked when a wrapper child's
     * own content or metadata changes, so it reconciles against any prior attach
     * recorded on `child.attachState`. `anchor` is the next sibling's backing
     * instance for ordered insertion, or `null`/`undefined` to append. `fresh`
     * marks a child the reconciler has not attached before, so its backing widget
     * is known to be unparented and the defensive unparent can be skipped.
     */
    attach(child: Instance, parent: Instance, anchor?: BackingInstance | null, fresh?: boolean): void;
    /** Reverses {@link attach}, removing `child` from `parent`. */
    detach(child: Instance, parent: Instance): void;
}

const isRooted = (instance: BackingInstance): boolean =>
    instance instanceof Gtk.Widget ? instance.getRoot() !== null : true;

const rescueFocus = (parent: BackingInstance, child: BackingInstance | undefined): void => {
    if (!(parent instanceof Gtk.Widget) || !(child instanceof Gtk.Widget)) return;
    const focus = getFocusWidget(child);
    if (focus && isDescendantOf(focus, child)) parent.grabFocus();
};

/**
 * The widget a child instance contributes to its parent: its backing widget,
 * unless it is a top-level surface (windows and dialogs never attach as widget
 * children) or a non-widget GObject.
 */
const childWidget = (instance: Instance): Gtk.Widget | null => {
    const widget = instance.backingInstance;
    if (!(widget instanceof Gtk.Widget)) return null;
    if (widget instanceof Gtk.Window || widget instanceof Adw.Dialog) return null;
    return widget;
};

// --- Wrapper content selection ---

const TAB_LABEL_KIND = "tab-label";
const META_OBJECT_KIND = "meta-object";

/** The wrapper's primary tracked content child, skipping the tab-label slot. */
const trackedChild = (marker: Instance): Instance | null =>
    marker.children.find((child) => !isWrapperKind(child, TAB_LABEL_KIND)) ?? marker.children[0] ?? null;

const trackedWidget = (marker: Instance): Gtk.Widget | null => {
    const child = trackedChild(marker);
    const widget = child?.backingInstance;
    return widget instanceof Gtk.Widget ? widget : null;
};

const trackedInstance = (marker: Instance): BackingInstance | undefined => trackedChild(marker)?.backingInstance;

const wrapperChildWidgets = (marker: Instance): Gtk.Widget[] => {
    const widgets: Gtk.Widget[] = [];
    for (const child of marker.children) {
        const widget = child.backingInstance;
        if (widget instanceof Gtk.Widget) widgets.push(widget);
    }
    return widgets;
};

const sameWidgets = (a: readonly Gtk.Widget[], b: readonly Gtk.Widget[]): boolean =>
    a.length === b.length && a.every((widget, index) => widget === b[index]);

// --- Slot (single, property setter) ---

type SlotState = { prop: string; value: BackingInstance };

const slotMapping: ElementMapping = {
    matches: (child, parent) => isWrapperKind(child, "slot") && parent.backingInstance !== undefined,
    attach: (child, parent) => {
        const prop = child.props.propName;
        const target = parent.backingInstance;
        if (typeof prop !== "string" || !target) return;
        const value = trackedInstance(child);
        const state = child.attachState as SlotState | undefined;
        if (state && state.value === value) return;
        Reflect.set(target, prop, value ?? null);
        child.attachState = value ? { prop, value } : undefined;
    },
    detach: (child, parent) => {
        const state = child.attachState as SlotState | undefined;
        const target = parent.backingInstance;
        child.attachState = undefined;
        if (!state || !target || !isRooted(target)) return;
        rescueFocus(target, state.value);
        Reflect.set(target, state.prop, null);
    },
};

// --- Container slot (multi, method append) ---

const containerSlotMapping: ElementMapping = {
    matches: (child, parent) => isWrapperKind(child, "container-slot") && parent.backingInstance !== undefined,
    attach: (child, parent) => {
        const method = child.props.method;
        const target = parent.backingInstance;
        if (typeof method !== "string" || !target) return;
        const desired = wrapperChildWidgets(child);
        const prev = (child.attachState as Gtk.Widget[] | undefined) ?? [];
        if (sameWidgets(prev, desired)) return;
        for (const widget of prev) unparentWidget(widget);
        for (const widget of desired) invokeRequired(target, method, widget);
        child.attachState = desired;
    },
    detach: (child) => {
        for (const widget of (child.attachState as Gtk.Widget[] | undefined) ?? []) unparentWidget(widget);
        child.attachState = undefined;
    },
};

const invokeMethod = (target: object, method: string, arg: unknown): void => {
    const fn = Reflect.get(target, method);
    if (typeof fn === "function") Reflect.apply(fn, target, [arg]);
};

const invokeRequired = (target: object, method: string, arg: unknown): void => {
    const fn = Reflect.get(target, method);
    if (typeof fn !== "function") {
        throw new TypeError(`Method '${method}' not found on '${target.constructor.name}'`);
    }
    Reflect.apply(fn, target, [arg]);
};

// --- Meta object (single, Stack / ViewStack / Notebook page) ---

const PAGE_META_SETTERS: readonly { setter: string; prop: string; fallback?: unknown; whenPresent?: boolean }[] = [
    { setter: "setTitle", prop: "title", whenPresent: true },
    { setter: "setIconName", prop: "iconName", whenPresent: true },
    { setter: "setNeedsAttention", prop: "needsAttention", fallback: false },
    { setter: "setVisible", prop: "visible", fallback: true },
    { setter: "setUseUnderline", prop: "useUnderline", fallback: false },
    { setter: "setBadgeNumber", prop: "badgeNumber", whenPresent: true },
];

const applyPageMeta = (page: object, props: Instance["props"]): void => {
    for (const { setter, prop, fallback, whenPresent } of PAGE_META_SETTERS) {
        if (typeof Reflect.get(page, setter) !== "function") continue;
        if (whenPresent && props[prop] === undefined) continue;
        invokeMethod(page, setter, props[prop] ?? fallback);
    }
};

type MetaState = { widget: Gtk.Widget; page: object };

const addStackPage = (stack: Gtk.Stack | Adw.ViewStack, widget: Gtk.Widget, props: Instance["props"]): object => {
    const id = typeof props.id === "string" ? props.id : null;
    const title = typeof props.title === "string" ? props.title : null;
    const iconName = typeof props.iconName === "string" ? props.iconName : null;
    if (stack instanceof Adw.ViewStack) {
        if (title != null && iconName != null) return stack.addTitledWithIcon(widget, id, title, iconName);
        if (title != null) return stack.addTitled(widget, id, title);
        if (id != null) return stack.addNamed(widget, id);
        return stack.add(widget);
    }
    if (title != null) return stack.addTitled(widget, id, title);
    if (id != null) return stack.addNamed(widget, id);
    return stack.addChild(widget);
};

const notebookPosition = (marker: Instance): number | null => {
    const siblings = marker.parent?.children.filter((child) => isWrapperKind(child, META_OBJECT_KIND)) ?? [];
    const index = siblings.indexOf(marker);
    return index >= 0 ? index : null;
};

const notebookTabLabel = (marker: Instance): Gtk.Widget => {
    const tab = marker.children.find((child) => isWrapperKind(child, TAB_LABEL_KIND));
    const label = tab?.children[0]?.backingInstance;
    if (label instanceof Gtk.Widget) return label;
    const synthesized = new Gtk.Label();
    synthesized.setLabel(typeof marker.props.label === "string" ? marker.props.label : "");
    return synthesized;
};

const applyNotebookMeta = (notebook: Gtk.Notebook, widget: Gtk.Widget, props: Instance["props"]): void => {
    const page = notebook.getPage(widget);
    if (!page) return;
    if (props.tabExpand !== undefined) Reflect.set(page, "tabExpand", props.tabExpand);
    if (props.tabFill !== undefined) Reflect.set(page, "tabFill", props.tabFill);
};

const updateNotebookTabLabel = (notebook: Gtk.Notebook, widget: Gtk.Widget, marker: Instance): void => {
    if (marker.children.some((child) => isWrapperKind(child, TAB_LABEL_KIND))) return;
    const current = notebook.getTabLabel(widget);
    if (current instanceof Gtk.Label)
        current.setLabel(typeof marker.props.label === "string" ? marker.props.label : "");
};

const attachNotebookPage = (notebook: Gtk.Notebook, widget: Gtk.Widget, marker: Instance): void => {
    const label = notebookTabLabel(marker);
    const position = notebookPosition(marker);
    if (position == null) notebook.appendPage(widget, label);
    else notebook.insertPage(widget, label, position);
    applyNotebookMeta(notebook, widget, marker.props);
};

const metaObjectMapping: ElementMapping = {
    matches: (child, parent) =>
        isWrapperKind(child, META_OBJECT_KIND) &&
        (parent.backingInstance instanceof Gtk.Stack ||
            parent.backingInstance instanceof Adw.ViewStack ||
            parent.backingInstance instanceof Gtk.Notebook),
    attach: (child, parent) => {
        const target = parent.backingInstance;
        const widget = trackedWidget(child);
        const state = child.attachState as MetaState | undefined;
        if (state && state.widget === widget) {
            if (target instanceof Gtk.Notebook) {
                updateNotebookTabLabel(target, state.widget, child);
                applyNotebookMeta(target, state.widget, child.props);
            } else {
                applyPageMeta(state.page, child.props);
            }
            return;
        }
        if (state) metaObjectMapping.detach(child, parent);
        if (!widget) return;
        if (target instanceof Gtk.Notebook) {
            attachNotebookPage(target, widget, child);
            child.attachState = { widget, page: target };
        } else if (target instanceof Gtk.Stack || target instanceof Adw.ViewStack) {
            const page = addStackPage(target, widget, child.props);
            applyPageMeta(page, child.props);
            child.attachState = { widget, page };
        }
    },
    detach: (child, parent) => {
        const state = child.attachState as MetaState | undefined;
        const target = parent.backingInstance;
        child.attachState = undefined;
        if (!state) return;
        if (target instanceof Gtk.Notebook) {
            const pageNum = target.pageNum(state.widget);
            if (pageNum !== -1) target.removePage(pageNum);
        } else if (
            (target instanceof Gtk.Stack || target instanceof Adw.ViewStack) &&
            isAttachedTo(state.widget, target)
        ) {
            target.remove(state.widget);
        }
    },
};

// --- Layout child (multi, Grid / Fixed layout-child props) ---

const resolveLayoutKind = (parent: BackingInstance): "grid" | "fixed" | null => {
    if (parent instanceof Gtk.Grid) return "grid";
    if (parent instanceof Gtk.Fixed) return "fixed";
    if (parent instanceof Gtk.Widget) {
        const layout = parent.getLayoutManager();
        if (layout instanceof Gtk.GridLayout) return "grid";
        if (layout instanceof Gtk.FixedLayout) return "fixed";
    }
    return null;
};

const buildFixedTransform = (props: Instance["props"]): Gsk.Transform | null => {
    const point = new Graphene.Point();
    point.init(typeof props.x === "number" ? props.x : 0, typeof props.y === "number" ? props.y : 0);
    let value: Gsk.Transform | null = Gsk.Transform.new().translate(point);
    if (props.transform instanceof Gsk.Transform && value) value = value.transform(props.transform);
    return value;
};

const applyGridLayoutChild = (layoutChild: Gtk.LayoutChild, props: Instance["props"]): void => {
    if ("column" in layoutChild) Reflect.set(layoutChild, "column", props.column ?? 0);
    if ("row" in layoutChild) Reflect.set(layoutChild, "row", props.row ?? 0);
    if ("columnSpan" in layoutChild) Reflect.set(layoutChild, "columnSpan", props.columnSpan ?? 1);
    if ("rowSpan" in layoutChild) Reflect.set(layoutChild, "rowSpan", props.rowSpan ?? 1);
};

const applyFixedLayoutChild = (layoutChild: Gtk.LayoutChild, props: Instance["props"]): void => {
    if (typeof Reflect.get(layoutChild, "setTransform") !== "function") return;
    const value = buildFixedTransform(props);
    if (value) invokeMethod(layoutChild, "setTransform", value);
};

const applyLayoutChild = (
    parent: Gtk.Widget,
    widget: Gtk.Widget,
    kind: "grid" | "fixed",
    props: Instance["props"],
): void => {
    const layout = parent.getLayoutManager();
    if (!layout) return;
    const layoutChild = layout.getLayoutChild(widget);
    if (kind === "grid") applyGridLayoutChild(layoutChild, props);
    else applyFixedLayoutChild(layoutChild, props);
};

const layoutChildMapping: ElementMapping = {
    matches: (child, parent) =>
        isWrapperKind(child, "layout-child") &&
        parent.backingInstance instanceof Gtk.Widget &&
        resolveLayoutKind(parent.backingInstance) !== null,
    attach: (child, parent) => {
        const target = parent.backingInstance;
        if (!(target instanceof Gtk.Widget)) return;
        const kind = resolveLayoutKind(target);
        if (!kind) return;
        const desired = wrapperChildWidgets(child);
        const prev = (child.attachState as Gtk.Widget[] | undefined) ?? [];
        for (const widget of prev) {
            if (!desired.includes(widget)) detachChild(widget, target);
        }
        for (const widget of desired) {
            if (widget.getParent() !== target) attachChild(widget, target);
            applyLayoutChild(target, widget, kind, child.props);
        }
        child.attachState = desired;
    },
    detach: (child, parent) => {
        const target = parent.backingInstance;
        for (const widget of (child.attachState as Gtk.Widget[] | undefined) ?? []) {
            if (target instanceof Gtk.Widget) detachChild(widget, target);
        }
        child.attachState = undefined;
    },
};

// --- Overlay (multi, GtkOverlay measure/clip flags) ---

const applyOverlayFlags = (overlay: Gtk.Overlay, widget: Gtk.Widget, props: Instance["props"]): void => {
    overlay.setMeasureOverlay(widget, props.measure === true);
    overlay.setClipOverlay(widget, props.clipOverlay === true);
};

const overlayMapping: ElementMapping = {
    matches: (child, parent) => isWrapperKind(child, "overlay") && parent.backingInstance instanceof Gtk.Overlay,
    attach: (child, parent) => {
        const overlay = parent.backingInstance;
        if (!(overlay instanceof Gtk.Overlay)) return;
        const desired = wrapperChildWidgets(child);
        const prev = (child.attachState as Gtk.Widget[] | undefined) ?? [];
        for (const widget of prev) {
            if (!desired.includes(widget) && widget.getParent() === overlay) overlay.removeOverlay(widget);
        }
        for (const widget of desired) {
            if (widget.getParent() !== overlay) overlay.addOverlay(widget);
            applyOverlayFlags(overlay, widget, child.props);
        }
        child.attachState = desired;
    },
    detach: (child, parent) => {
        const overlay = parent.backingInstance;
        for (const widget of (child.attachState as Gtk.Widget[] | undefined) ?? []) {
            if (overlay instanceof Gtk.Overlay && widget.getParent() === overlay) overlay.removeOverlay(widget);
            else if (widget instanceof Gtk.Widget) unparentWidget(widget);
        }
        child.attachState = undefined;
    },
};

// --- Transparent (single, attaches its child to the marker's parent widget) ---

const transparentMapping: ElementMapping = {
    matches: (child, parent) => isWrapperKind(child, "transparent") && parent.backingInstance instanceof Gtk.Widget,
    attach: (child, parent) => {
        const target = parent.backingInstance;
        if (!(target instanceof Gtk.Widget)) return;
        const widget = trackedWidget(child);
        const prev = child.attachState as Gtk.Widget | undefined;
        if (prev && prev !== widget) {
            detachChild(prev, target);
            child.attachState = undefined;
        }
        if (!widget || widget.getParent() === target) return;
        attachChild(widget, target);
        child.attachState = widget;
    },
    detach: (child, parent) => {
        const widget = child.attachState as Gtk.Widget | undefined;
        const target = parent.backingInstance;
        if (widget && target instanceof Gtk.Widget) detachChild(widget, target);
        child.attachState = undefined;
    },
};

// --- Non-widget GObject children attached through a fixed relationship ---

const eventControllerMapping: ElementMapping = {
    matches: (child, parent) =>
        child.backingInstance instanceof Gtk.EventController && parent.backingInstance instanceof Gtk.Widget,
    attach: (child, parent) => {
        if (child.backingInstance instanceof Gtk.EventController && parent.backingInstance instanceof Gtk.Widget) {
            parent.backingInstance.addController(child.backingInstance);
        }
    },
    detach: (child, parent) => {
        if (
            child.backingInstance instanceof Gtk.EventController &&
            parent.backingInstance instanceof Gtk.Widget &&
            child.backingInstance.getWidget() === parent.backingInstance
        ) {
            parent.backingInstance.removeController(child.backingInstance);
        }
    },
};

const layoutManagerMapping: ElementMapping = {
    matches: (child, parent) =>
        child.backingInstance instanceof Gtk.LayoutManager && parent.backingInstance instanceof Gtk.Widget,
    attach: (child, parent) => {
        if (child.backingInstance instanceof Gtk.LayoutManager && parent.backingInstance instanceof Gtk.Widget) {
            parent.backingInstance.setLayoutManager(child.backingInstance);
        }
    },
    detach: (child, parent) => {
        if (
            child.backingInstance instanceof Gtk.LayoutManager &&
            parent.backingInstance instanceof Gtk.Widget &&
            parent.backingInstance.getLayoutManager() === child.backingInstance
        ) {
            parent.backingInstance.setLayoutManager(null);
        }
    },
};

const shortcutMapping: ElementMapping = {
    matches: (child, parent) =>
        child.backingInstance instanceof Gtk.Shortcut && parent.backingInstance instanceof Gtk.ShortcutController,
    attach: (child, parent) => {
        if (child.backingInstance instanceof Gtk.Shortcut && parent.backingInstance instanceof Gtk.ShortcutController) {
            parent.backingInstance.addShortcut(child.backingInstance);
        }
    },
    detach: (child, parent) => {
        if (child.backingInstance instanceof Gtk.Shortcut && parent.backingInstance instanceof Gtk.ShortcutController) {
            parent.backingInstance.removeShortcut(child.backingInstance);
        }
    },
};

// --- Column view column (ordered, insertColumn / removeColumn) ---

type ColumnAttachState = { view: Gtk.ColumnView; column: Gtk.ColumnViewColumn };

/**
 * The index `column` currently occupies in `columnView`'s live column list, or
 * `-1` when it is not present.
 */
const columnIndexOf = (columnView: Gtk.ColumnView, column: Gtk.ColumnViewColumn): number => {
    const columns = columnView.getColumns();
    const nItems = columns.getNItems();
    for (let i = 0; i < nItems; i++) {
        if (columns.getItem(i) === column) return i;
    }
    return -1;
};

/**
 * The position `column` should insert at to land before `anchor`, computed
 * against the live column list that must NOT contain `column` (a move removes it
 * first): the anchor's current index, or the end when there is no anchor or it
 * is not present, mirroring {@link findInsertPosition} over the column
 * `ListModel` rather than the widget children.
 */
const columnInsertPosition = (columnView: Gtk.ColumnView, anchor: BackingInstance | null | undefined): number => {
    const columns = columnView.getColumns();
    const nItems = columns.getNItems();
    if (anchor instanceof Gtk.ColumnViewColumn) {
        for (let i = 0; i < nItems; i++) {
            if (columns.getItem(i) === anchor) return i;
        }
    }
    return nItems;
};

/**
 * Whether `column` already sits immediately before `anchor` (or last, when there
 * is no anchor) in the live column list, so a re-invoked attach can skip the
 * remove/insert.
 */
const columnIsPlacedBefore = (
    columnView: Gtk.ColumnView,
    column: Gtk.ColumnViewColumn,
    anchor: BackingInstance | null | undefined,
): boolean => {
    const index = columnIndexOf(columnView, column);
    if (index < 0) return false;
    if (anchor instanceof Gtk.ColumnViewColumn) return columnIndexOf(columnView, anchor) === index + 1;
    return index === columnView.getColumns().getNItems() - 1;
};

const columnViewColumnMapping: ElementMapping = {
    matches: (child, parent) =>
        child.backingInstance instanceof Gtk.ColumnViewColumn && parent.backingInstance instanceof Gtk.ColumnView,
    attach: (child, parent, anchor) => {
        const column = child.backingInstance;
        const columnView = parent.backingInstance;
        if (!(column instanceof Gtk.ColumnViewColumn) || !(columnView instanceof Gtk.ColumnView)) return;
        const state = child.attachState as ColumnAttachState | undefined;
        const alreadyAttached = state?.view === columnView;
        if (alreadyAttached) {
            if (columnIsPlacedBefore(columnView, column, anchor)) return;
            if (columnIndexOf(columnView, column) >= 0) columnView.removeColumn(column);
        }
        const position = columnInsertPosition(columnView, anchor);
        columnView.insertColumn(position, column);
        if (!alreadyAttached) {
            child.attachState = { view: columnView, column };
            const list = getColumnViewController(columnView);
            if (list) getColumnController(column)?.register(list, columnView);
        }
        getColumnViewController(columnView)?.scheduleColumnSettle();
    },
    detach: (child, parent) => {
        const column = child.backingInstance;
        const columnView = parent.backingInstance;
        const state = child.attachState as ColumnAttachState | undefined;
        if (!(column instanceof Gtk.ColumnViewColumn) || !(columnView instanceof Gtk.ColumnView)) return;
        if (state?.view !== columnView) return;
        columnView.removeColumn(column);
        getColumnController(column)?.unregister(columnView);
        child.attachState = undefined;
        getColumnViewController(columnView)?.scheduleColumnSettle();
    },
};

// --- Top-level surfaces ---

const isTopLevel = (instance: Instance): boolean =>
    instance.backingInstance instanceof Gtk.Window || instance.backingInstance instanceof Adw.Dialog;

const topLevelSkipMapping: ElementMapping = {
    matches: (child) => isTopLevel(child),
    attach: () => {},
    detach: () => {},
};

// --- Non-widget single-child containers (list factory cells) ---

const listItemChildMapping: ElementMapping = {
    matches: (child, parent) =>
        child.backingInstance instanceof Gtk.Widget &&
        !(parent.backingInstance instanceof Gtk.Widget) &&
        isSingleChildContainer(parent.backingInstance),
    attach: (child, parent, _anchor, fresh) => {
        if (child.backingInstance instanceof Gtk.Widget && isSingleChildContainer(parent.backingInstance)) {
            if (fresh !== true) unparentWidget(child.backingInstance);
            parent.backingInstance.setChild(child.backingInstance);
        }
    },
    detach: (child, parent) => {
        if (
            child.backingInstance instanceof Gtk.Widget &&
            isSingleChildContainer(parent.backingInstance) &&
            parent.backingInstance.getChild() === child.backingInstance
        ) {
            parent.backingInstance.setChild(null);
        }
    },
};

// --- Generic widget container (fallback) ---

const isAutowrap = (container: Gtk.Widget, widget: Gtk.Widget): boolean =>
    (container instanceof Gtk.ListBox || container instanceof Gtk.FlowBox) &&
    !(widget instanceof Gtk.ListBoxRow || widget instanceof Gtk.FlowBoxChild);

const detachAutowrapped = (widget: Gtk.Widget): void => {
    const wrapper = widget.getParent();
    if (wrapper && isSingleChild(wrapper)) {
        wrapper.setChild(null);
        const wrapperParent = wrapper.getParent();
        if (wrapperParent && isRemovableWidget(wrapperParent)) wrapperParent.remove(wrapper);
    }
};

const isRemovableWidget = (widget: Gtk.Widget): widget is Gtk.Widget & { remove: (child: Gtk.Widget) => void } =>
    "remove" in widget && typeof Reflect.get(widget, "remove") === "function";

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
            if (isRemovableWidget(currentParent)) currentParent.remove(widget);
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

const reinsertAll = (parent: Instance, container: Gtk.Widget): void => {
    const widgets: Gtk.Widget[] = [];
    for (const child of parent.children) {
        const widget = childWidget(child);
        if (widget) widgets.push(widget);
    }
    for (const widget of widgets) detachChild(widget, container);
    for (const widget of widgets) attachChild(widget, container);
};

const insertWidgetBefore = (parent: Instance, container: Gtk.Widget, widget: Gtk.Widget, anchor: Gtk.Widget): void => {
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
        if (isRemovableWidget(container)) container.remove(wrapper);
    }
};

const widgetContainerMapping: ElementMapping = {
    matches: (child, parent) => childWidget(child) !== null && parent.backingInstance instanceof Gtk.Widget,
    attach: (child, parent, anchor, fresh) => {
        const container = parent.backingInstance;
        const widget = childWidget(child);
        if (!(container instanceof Gtk.Widget) || !widget) return;
        if (anchor instanceof Gtk.Widget) insertWidgetBefore(parent, container, widget, anchor);
        else appendWidget(container, widget, fresh === true);
    },
    detach: (child, parent) => {
        const container = parent.backingInstance;
        const widget = childWidget(child);
        if (container instanceof Gtk.Widget && widget) removeWidget(container, widget);
    },
};

/**
 * The ordered attach/detach table. The reconciler applies the first matching
 * entry, so specific relationships precede the generic widget-container
 * fallback. Wrappers that carry buffered text content (`text`, `text-anchor`,
 * `text-paintable`) and the inert `tab-label` slot have no entry: the text-buffer
 * controller and the enclosing `meta-object` consume them.
 */
export const ELEMENT_MAP: readonly ElementMapping[] = [
    slotMapping,
    containerSlotMapping,
    metaObjectMapping,
    layoutChildMapping,
    overlayMapping,
    transparentMapping,
    eventControllerMapping,
    layoutManagerMapping,
    shortcutMapping,
    columnViewColumnMapping,
    topLevelSkipMapping,
    listItemChildMapping,
    widgetContainerMapping,
];

const resolveMapping = (child: Instance, parent: Instance): ElementMapping | undefined =>
    ELEMENT_MAP.find((mapping) => mapping.matches(child, parent));

/**
 * Attaches `child` to `parent` through the first matching {@link ELEMENT_MAP}
 * entry. `anchor` is the next sibling's backing instance for ordered insertion.
 *
 * @param child - The child instance being attached.
 * @param parent - The parent instance it attaches to.
 * @param anchor - The next sibling's backing instance, or `null` to append.
 * @param fresh - Whether the child has not been attached before, so its backing
 *   widget is known unparented and the defensive unparent can be skipped.
 */
export const attachToParent = (
    child: Instance,
    parent: Instance,
    anchor?: BackingInstance | null,
    fresh?: boolean,
): void => {
    resolveMapping(child, parent)?.attach(child, parent, anchor, fresh);
};

/**
 * Reverses {@link attachToParent}, detaching `child` from `parent`.
 *
 * @param child - The child instance being detached.
 * @param parent - The parent instance it detaches from.
 */
export const detachFromParent = (child: Instance, parent: Instance): void => {
    resolveMapping(child, parent)?.detach(child, parent);
};

/**
 * Re-runs a metadata wrapper's idempotent attach against its current parent so
 * its content and metadata reconcile after a child or prop change.
 *
 * @param marker - The wrapper instance to resynchronize.
 */
export const resyncWrapper = (marker: Instance): void => {
    const parent = marker.parent;
    if (isWrapperInstance(marker) && parent) attachToParent(marker, parent);
};

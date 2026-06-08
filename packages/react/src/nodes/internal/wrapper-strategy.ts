/**
 * Resolves the {@link AttachStrategy} and child-cardinality for a generic
 * wrapper kind against a live parent GObject.
 *
 * The reconciler collapses every metadata wrapper into the single
 * {@link WrapperNode}, which carries a small set of generic kinds (`"slot"`,
 * `"container-slot"`, `"meta-object"`, `"layout-child"`, `"overlay"`,
 * `"wrap-then-add"`, `"transparent"`, `"notebook-tab"`). Each kind plus the
 * parent's capabilities selects one of the descriptor shapes the strategy
 * interpreter consumes. The descriptors themselves stay identical to the data
 * the interpreter already executes; only their selection moves from a keyed
 * table to capability and `instanceof` detection here.
 */
import * as Adw from "@gtkx/gi/adw";
import * as Gtk from "@gtkx/gi/gtk";
import type { Node } from "../../node.js";
import type { BackingInstance, Props } from "../../types.js";
import type {
    AddAndConfigureMetaObjectStrategy,
    AttachAndConfigureLayoutChildStrategy,
    AttachStrategy,
    MetaSetter,
    MethodArm,
    NotebookPageStrategy,
    OverlayChildStrategy,
    WrapThenAddStrategy,
} from "./attach-strategy.js";

/** The ancillary notebook tab wrapper kind, excluded from the page content slot. */
export const NOTEBOOK_TAB_KIND = "notebook-tab";

const CHILD = { from: "child" } as const;

const STACK_PAGE_META_SETTERS: readonly MetaSetter[] = [
    { setter: "setTitle", prop: "title", whenPresent: true },
    { setter: "setIconName", prop: "iconName", whenPresent: true },
    { setter: "setNeedsAttention", prop: "needsAttention", fallback: false },
    { setter: "setVisible", prop: "visible", fallback: true },
    { setter: "setUseUnderline", prop: "useUnderline", fallback: false },
    { setter: "setBadgeNumber", prop: "badgeNumber", whenPresent: true },
];

const ADD_TITLED_ARM: MethodArm = {
    method: "addTitled",
    args: [CHILD, { from: "prop", name: "id", fallback: null }, { from: "prop", name: "title" }],
    conditions: ["title"],
};

const ADD_NAMED_ARM: MethodArm = {
    method: "addNamed",
    args: [CHILD, { from: "prop", name: "id" }],
    conditions: ["id"],
};

const STACK_PAGE_STRATEGY: AddAndConfigureMetaObjectStrategy = {
    kind: "add-and-configure-meta-object",
    arms: [ADD_TITLED_ARM, ADD_NAMED_ARM, { method: "addChild", args: [CHILD] }],
    removeMethod: "remove",
    metaSetters: STACK_PAGE_META_SETTERS,
};

const VIEW_STACK_PAGE_STRATEGY: AddAndConfigureMetaObjectStrategy = {
    kind: "add-and-configure-meta-object",
    arms: [
        {
            method: "addTitledWithIcon",
            args: [
                CHILD,
                { from: "prop", name: "id", fallback: null },
                { from: "prop", name: "title" },
                { from: "prop", name: "iconName" },
            ],
            conditions: ["title", "iconName"],
        },
        ADD_TITLED_ARM,
        ADD_NAMED_ARM,
        { method: "add", args: [CHILD] },
    ],
    removeMethod: "remove",
    metaSetters: STACK_PAGE_META_SETTERS,
};

const NOTEBOOK_PAGE_STRATEGY: NotebookPageStrategy = {
    kind: "notebook-page",
    tabChildKind: NOTEBOOK_TAB_KIND,
    labelProp: "label",
    metaProps: [{ prop: "tabExpand" }, { prop: "tabFill" }],
};

const NAVIGATION_PAGE_STRATEGY: WrapThenAddStrategy = {
    kind: "wrap-then-add",
    wrapperType: "AdwNavigationPage",
    taggedConstructor: "newWithTag",
    plainConstructor: "new",
    titleProp: "title",
    tagProp: "id",
    containerType: "AdwNavigationView",
    addMethod: "add",
    removeMethod: "remove",
    metaSetters: [
        { setter: "setTag", prop: "id", whenPresent: true },
        { setter: "setTitle", prop: "title", fallback: "" },
        { setter: "setCanPop", prop: "canPop", fallback: true },
    ],
    slotFromProp: "id",
    rescueFocus: true,
};

const GRID_CHILD_STRATEGY: AttachAndConfigureLayoutChildStrategy = {
    kind: "attach-and-configure-layout-child",
    layoutChildProps: [
        { prop: "column", fallback: 0 },
        { prop: "row", fallback: 0 },
        { prop: "columnSpan", fallback: 1 },
        { prop: "rowSpan", fallback: 1 },
    ],
};

const FIXED_CHILD_STRATEGY: AttachAndConfigureLayoutChildStrategy = {
    kind: "attach-and-configure-layout-child",
    transform: { xProp: "x", yProp: "y", userProp: "transform" },
};

const OVERLAY_CHILD_STRATEGY: OverlayChildStrategy = {
    kind: "overlay-child",
    addMethod: "addOverlay",
    removeMethod: "removeOverlay",
    perChildSetters: [
        { setter: "setMeasureOverlay", prop: "measure", fallback: false },
        { setter: "setClipOverlay", prop: "clipOverlay", fallback: false },
    ],
};

const resolveMetaObject = (parentInstance: BackingInstance): AttachStrategy | null => {
    if (parentInstance instanceof Gtk.Stack) return STACK_PAGE_STRATEGY;
    if (parentInstance instanceof Adw.ViewStack) return VIEW_STACK_PAGE_STRATEGY;
    if (parentInstance instanceof Gtk.Notebook) return NOTEBOOK_PAGE_STRATEGY;
    return null;
};

const resolveLayoutChild = (parentInstance: BackingInstance): AttachStrategy | null => {
    if (parentInstance instanceof Gtk.Grid) return GRID_CHILD_STRATEGY;
    if (parentInstance instanceof Gtk.Fixed) return FIXED_CHILD_STRATEGY;
    if (parentInstance instanceof Gtk.Widget) {
        const layout = parentInstance.getLayoutManager();
        if (layout instanceof Gtk.GridLayout) return GRID_CHILD_STRATEGY;
        if (layout instanceof Gtk.FixedLayout) return FIXED_CHILD_STRATEGY;
    }
    return null;
};

const resolveSlot = (props: Props): AttachStrategy | null => {
    const prop = props.propName;
    if (typeof prop !== "string") return null;
    return { kind: "property-set", prop, skipDetachOnDelete: true, rescueFocus: true };
};

const resolveContainerSlot = (props: Props): AttachStrategy | null => {
    const addMethod = props.method;
    if (typeof addMethod !== "string") return null;
    return { kind: "method-call", addMethod };
};

/**
 * Resolves the attachment strategy for a wrapper of the generic `kind`
 * attaching its child to `parentInstance`.
 *
 * @param kind - The generic wrapper kind (`"slot"`, `"meta-object"`, …).
 * @param props - The wrapper props carrying the attachment metadata.
 * @param parentInstance - The live GTK parent the child attaches to.
 * @returns The matching strategy, or `null` when the kind is inert (notebook
 *   tab) or the parent provides no matching capability.
 */
export const resolveWrapperStrategy = (
    kind: string,
    props: Props,
    parentInstance: BackingInstance,
): AttachStrategy | null => {
    switch (kind) {
        case "slot":
            return resolveSlot(props);
        case "container-slot":
            return resolveContainerSlot(props);
        case "meta-object":
            return resolveMetaObject(parentInstance);
        case "layout-child":
            return resolveLayoutChild(parentInstance);
        case "overlay":
            return OVERLAY_CHILD_STRATEGY;
        case "wrap-then-add":
            return NAVIGATION_PAGE_STRATEGY;
        case "transparent":
            return { kind: "transparent-passthrough" };
        default:
            return null;
    }
};

/** Child-cardinality configuration for a generic wrapper kind. */
export interface WrapperCardinality {
    /**
     * Whether the wrapper tracks a single primary child (slot/page semantics)
     * versus attaching every child to the grandparent (overlay, layout-child,
     * container-slot).
     */
    readonly singleTracked: boolean;
    /**
     * Selects the primary tracked child from the children list when
     * `singleTracked` is true. Defaults to the first child; the notebook
     * meta-object overrides it to skip its ancillary tab child.
     */
    readonly trackedChildSelector?: (children: readonly Node[]) => Node | null;
    /**
     * When true the wrapper has no GTK child to attach: the strategy constructs
     * and adds what it attaches. The attach runs once per wrapper, with no child
     * instance, keyed by the wrapper itself.
     */
    readonly selfBuilt?: boolean;
    /**
     * When true the wrapper defers its attach and prop-driven re-attach until
     * after the commit, letting a sibling layout manager settle first.
     */
    readonly deferAttach?: boolean;
}

const SINGLE_TRACKED: WrapperCardinality = { singleTracked: true };
const MULTI_TRACKED: WrapperCardinality = { singleTracked: false };

const firstNonTabChild = (children: readonly Node[]): Node | null =>
    children.find((child) => child.typeName !== NOTEBOOK_TAB_KIND) ?? null;

const NOTEBOOK_META_OBJECT: WrapperCardinality = {
    singleTracked: true,
    trackedChildSelector: firstNonTabChild,
};

const CARDINALITIES: ReadonlyMap<string, WrapperCardinality> = new Map<string, WrapperCardinality>([
    ["slot", SINGLE_TRACKED],
    ["container-slot", MULTI_TRACKED],
    ["meta-object", NOTEBOOK_META_OBJECT],
    ["layout-child", MULTI_TRACKED],
    ["overlay", MULTI_TRACKED],
    ["wrap-then-add", SINGLE_TRACKED],
    ["transparent", SINGLE_TRACKED],
    ["notebook-tab", SINGLE_TRACKED],
]);

/**
 * Returns the child-cardinality configuration for a generic wrapper kind.
 *
 * The `meta-object` cardinality skips an ancillary notebook tab child when
 * selecting the tracked content child, which is inert for stack/view-stack
 * pages that carry no such child.
 *
 * @param kind - The generic wrapper kind (`"slot"`, `"meta-object"`, …).
 * @returns The cardinality configuration; single-tracked by default.
 */
export const wrapperCardinality = (kind: string): WrapperCardinality => CARDINALITIES.get(kind) ?? SINGLE_TRACKED;

import type { AdoptedElement, ContainerProp, ElementProp } from "@gtkx/config";
import type * as GObject from "@gtkx/gi/gobject";
import type * as Gtk from "@gtkx/gi/gtk";
import type { Props } from "./kinds.js";

/** Values available to a container behavior while attaching or moving one child. */
export type PlaceContext<C = GObject.Object, CP = Props> = {
    index: number;
    sibling: C | null;
    adopted: GObject.Object | null;
    props: CP;
};

/** Values available to a container behavior while detaching one child. */
export type DetachContext<CP = Props> = { adopted: GObject.Object | null; props: CP };

/**
 * Imperative overrides for a container element prop. Any hook present here replaces the
 * declarative call of the same role, so a rule states its method names for codegen and its
 * behavior for the runtime in one entry.
 */
export type ContainerBehavior<P = GObject.Object, C = GObject.Object, CP = Props> = {
    attach?: (parent: P, child: C, context: PlaceContext<C, CP>) => unknown;
    detach?: (parent: P, child: C, context: DetachContext<CP>) => void;
    insert?: (parent: P, child: C, context: PlaceContext<C, CP>) => unknown;
    reorder?: (parent: P, child: C, context: PlaceContext<C, CP>) => unknown;
    resolve?: (parent: P, child: C) => GObject.Object | null;
};

/** Imperative overrides for a list element prop, replacing the declarative call of the same role. */
export type ListBehavior<P = GObject.Object, I = unknown> = {
    add?: (parent: P, item: I) => void;
    remove?: (parent: P, item: I) => void;
    clear?: (parent: P) => void;
};

const behaviors = new Map<string, ContainerBehavior>();

const listBehaviors = new Map<string, ListBehavior>();

const listKey = (type: string, prop: string): string => `${type}:${prop}`;

/** Returns the imperative behavior registered for a list prop, if any. */
export const listBehaviorFor = (type: string, prop: string): ListBehavior | undefined =>
    listBehaviors.get(listKey(type, prop));

const withListBehavior = <P extends GObject.Object, I>(
    type: string,
    rule: ElementProp,
    behavior: ListBehavior<P, I>,
): ElementProp => {
    if (rule.kind === "list") listBehaviors.set(listKey(type, rule.prop), behavior as ListBehavior);
    return rule;
};

const behaviorKey = (type: string, prop: string, child: string): string => `${type}:${prop}:${child}`;

/** Returns the imperative behavior registered for a container prop and child type, if any. */
export const behaviorFor = (type: string, prop: string, child: string): ContainerBehavior | undefined =>
    behaviors.get(behaviorKey(type, prop, child));

const withBehavior = <P extends GObject.Object, C extends GObject.Object, CP = Props>(
    type: string,
    rule: ElementProp,
    behavior: ContainerBehavior<P, C, CP>,
): ElementProp => {
    if (rule.kind === "container")
        behaviors.set(behaviorKey(type, rule.prop, rule.child), behavior as ContainerBehavior);
    return rule;
};

type TabViewLike = GObject.Object & {
    append: (child: Gtk.Widget) => GObject.Object;
    insert: (child: Gtk.Widget, position: number) => GObject.Object;
    reorderPage: (page: GObject.Object, position: number) => boolean;
    closePage: (page: GObject.Object) => void;
    getPage: (child: Gtk.Widget) => GObject.Object;
};

const buildMenu = (items: MenuItem[], create: () => MenuLike): MenuLike => {
    const menu = create();
    for (const item of items) appendMenuItem(menu, item);
    return menu;
};

let createMenu: () => MenuLike = () => {
    throw new Error("GMenu construction is not available");
};

/** Installs the factory used to build nested `GMenu` instances for submenus and sections. */
export const setMenuFactory = (factory: () => GObject.Object): void => {
    createMenu = factory as () => MenuLike;
};

function appendMenuItem(menu: MenuLike, item: MenuItem): void {
    if (item.submenu !== undefined) menu.appendSubmenu(item.label ?? null, buildMenu(item.submenu, createMenu));
    else if (item.section !== undefined) menu.appendSection(item.label ?? null, buildMenu(item.section, createMenu));
    else menu.append(item.label ?? null, item.action ?? null);
}

const layoutChild = (parent: Gtk.Widget, child: Gtk.Widget): GObject.Object | null =>
    parent.getLayoutManager()?.getLayoutChild(child) ?? null;

type ManyMethods = Pick<ContainerProp, "append" | "remove">;

const container = (
    prop: string,
    child: string,
    methods: Omit<ContainerProp, "kind" | "prop" | "child">,
): ElementProp => ({
    kind: "container",
    prop,
    child,
    ...methods,
});

type ChildSetter = GObject.Object & { setChild: (child: Gtk.Widget | null) => void };

type ContentSetter = GObject.Object & { setContent: (content: Gtk.Widget | null) => void };

type BoxLike = GObject.Object & {
    append: (child: Gtk.Widget) => void;
    remove: (child: Gtk.Widget) => void;
    insertChildAfter: (child: Gtk.Widget, sibling: Gtk.Widget | null) => void;
    reorderChildAfter: (child: Gtk.Widget, sibling: Gtk.Widget | null) => void;
};

type IndexedLike = GObject.Object & {
    remove: (child: Gtk.Widget) => void;
    insert: (child: Gtk.Widget, position: number) => void;
};

const singleChild = (type: string): ElementProp =>
    withBehavior<ChildSetter, Gtk.Widget>(
        type,
        container("children", "GtkWidget", { append: "setChild", remove: "setChild" }),
        {
            attach: (parent, child) => parent.setChild(child),
            detach: (parent) => parent.setChild(null),
        },
    );

const singleContent = (type: string): ElementProp =>
    withBehavior<ContentSetter, Gtk.Widget>(
        type,
        container("children", "GtkWidget", { append: "setContent", remove: "setContent" }),
        {
            attach: (parent, child) => parent.setContent(child),
            detach: (parent) => parent.setContent(null),
        },
    );

const boxChildren = (type: string): ElementProp =>
    withBehavior<BoxLike, Gtk.Widget>(
        type,
        container("children", "GtkWidget", {
            append: "append",
            remove: "remove",
            insert: "insertChildAfter",
            reorder: "reorderChildAfter",
        }),
        {
            attach: (box, child) => box.append(child),
            detach: (box, child) => box.remove(child),
            insert: (box, child, { sibling }) => box.insertChildAfter(child, sibling),
            reorder: (box, child, { sibling }) => box.reorderChildAfter(child, sibling),
        },
    );

const autowrapChildren = (type: string, wrapper: string): ElementProp =>
    withBehavior<IndexedLike & { append: (child: Gtk.Widget) => void }, Gtk.Widget>(
        type,
        container("children", "GtkWidget", {
            append: "append",
            remove: "remove",
            insert: "insert",
            autowrap: wrapper,
        }),
        {
            attach: (parent, child) => parent.append(child),
            detach: (parent, child) => parent.remove(child),
            insert: (parent, child, { index }) => parent.insert(child, index),
        },
    );

const addRemoveChildren = (): ElementProp => container("children", "GtkWidget", { append: "add", remove: "remove" });

const prefixSuffixProps = (): ElementProp[] => [
    container("prefix", "GtkWidget", { append: "addPrefix" }),
    container("suffix", "GtkWidget", { append: "addSuffix" }),
];

const packProps = (): ElementProp[] => [
    container("start", "GtkWidget", { append: "packStart" }),
    container("end", "GtkWidget", { append: "packEnd" }),
];

const adopts = (element: string): AdoptedElement => ({ element });

const forEach = (types: string[], build: (type: string) => ElementProp[]): Record<string, ElementProp[]> =>
    Object.fromEntries(types.map((type) => [type, build(type)]));

const CONTROLLER_METHODS = { append: "addController", remove: "removeController" } satisfies ManyMethods;
const SHORTCUT_METHODS = { append: "addShortcut", remove: "removeShortcut" } satisfies ManyMethods;

type LayoutManagerHost = GObject.Object & { setLayoutManager: (manager: GObject.Object | null) => void };

type BufferHost = GObject.Object & { setBuffer: (buffer: GObject.Object | null) => void };

type ColumnViewLike = GObject.Object & {
    appendColumn: (column: GObject.Object) => void;
    removeColumn: (column: GObject.Object) => void;
    insertColumn: (position: number, column: GObject.Object) => void;
};

type ActionMapLike = GObject.Object & {
    addAction: (action: GObject.Object) => void;
    removeAction: (name: string) => void;
};

type ActionGroupHost = GObject.Object & {
    insertActionGroup: (prefix: string, group: GObject.Object | null) => void;
};

type ActionGroupPlacement = { prefix?: string };

/** One entry of a `GMenu`'s `items` prop; `submenu` and `section` nest further menus. */
export type MenuItem = {
    label?: string | null;
    action?: string | null;
    submenu?: MenuItem[];
    section?: MenuItem[];
};

type MenuLike = GObject.Object & {
    append: (label: string | null, action: string | null) => void;
    appendSubmenu: (label: string | null, submenu: GObject.Object) => void;
    appendSection: (label: string | null, section: GObject.Object) => void;
    removeAll: () => void;
};

type AccelHost = GObject.Object & {
    setAccelsForAction: (detailedActionName: string, accels: string[]) => void;
};

type ActionAccel = { detailedActionName: string; accels: string[] };

/** One Visual Format Language block applied to a `Gtk.ConstraintLayout`. */
export type VflConstraints = {
    lines: string[];
    hspacing?: number;
    vspacing?: number;
    views?: Map<string, Gtk.ConstraintTarget>;
};

type ConstraintLayoutLike = GObject.Object & {
    addConstraintsFromDescription: (
        lines: string[],
        hspacing: number,
        vspacing: number,
        views: Map<string, Gtk.ConstraintTarget>,
    ) => Iterable<Gtk.Constraint>;
    removeConstraint: (constraint: Gtk.Constraint) => void;
};

const vflConstraints = new WeakMap<VflConstraints, Gtk.Constraint[]>();

type ScaleMark = { value?: number; position: Gtk.PositionType; markup?: string | null };

type ScaleLike = GObject.Object & {
    addMark: (value: number, position: Gtk.PositionType, markup: string | null) => void;
    clearMarks: () => void;
};

type LevelBarOffset = { name: string; value?: number };

type LevelBarLike = GObject.Object & {
    addOffsetValue: (name: string, value: number) => void;
    removeOffsetValue: (name: string) => void;
};

type CreditSection = { sectionName: string; people: string[] };

type AboutDialogLike = GObject.Object & {
    addCreditSection: (sectionName: string, people: string[]) => void;
};

type AlertDialogResponse = { id: string; label: string; appearance?: number; enabled?: boolean };

type AlertDialogLike = GObject.Object & {
    addResponse: (id: string, label: string) => void;
    setResponseAppearance: (response: string, appearance: number) => void;
    setResponseEnabled: (response: string, enabled: boolean) => void;
    removeResponse: (response: string) => void;
};

type ActionPlacement = { name?: string };

const SINGLE_CHILD_TYPES = [
    "AdwBin",
    "AdwBreakpointBin",
    "AdwClamp",
    "AdwClampScrollable",
    "AdwDialog",
    "AdwNavigationPage",
    "AdwSplitButton",
    "AdwStatusPage",
    "AdwTabOverview",
    "AdwToastOverlay",
    "AdwToggle",
    "GtkAspectFrame",
    "GtkButton",
    "GtkCheckButton",
    "GtkComboBox",
    "GtkDragIcon",
    "GtkExpander",
    "GtkFlowBoxChild",
    "GtkFrame",
    "GtkGraphicsOffload",
    "GtkListBoxRow",
    "GtkListHeader",
    "GtkListItem",
    "GtkMenuButton",
    "GtkPopover",
    "GtkPopoverBin",
    "GtkRevealer",
    "GtkScrolledWindow",
    "GtkSearchBar",
    "GtkTreeExpander",
    "GtkViewport",
    "GtkWindow",
    "GtkWindowHandle",
];

const SINGLE_CONTENT_TYPES = [
    "AdwApplicationWindow",
    "AdwBottomSheet",
    "AdwFlap",
    "AdwNavigationSplitView",
    "AdwOverlaySplitView",
    "AdwWindow",
];

const BOX_TYPES = ["AdwLeaflet", "AdwWrapBox", "GtkBox"];

const ADD_REMOVE_TYPES = [
    "AdwNavigationView",
    "AdwPreferencesDialog",
    "AdwPreferencesGroup",
    "AdwPreferencesWindow",
    "AdwSqueezer",
];

const withBreakpoints = (props: Record<string, ElementProp[]>): Record<string, ElementProp[]> => {
    for (const type of ["AdwApplicationWindow", "AdwWindow", "AdwDialog"]) {
        props[type] = [...(props[type] ?? []), container("breakpoints", "AdwBreakpoint", { append: "addBreakpoint" })];
    }
    props.AdwBreakpointBin = [
        ...(props.AdwBreakpointBin ?? []),
        container("breakpoints", "AdwBreakpoint", { append: "addBreakpoint", remove: "removeBreakpoint" }),
    ];
    return props;
};

export const ELEMENT_RULES: Record<string, ElementProp[]> = withBreakpoints({
    ...forEach(SINGLE_CHILD_TYPES, (type) => [singleChild(type)]),
    ...forEach(SINGLE_CONTENT_TYPES, (type) => [singleContent(type)]),
    ...forEach(BOX_TYPES, (type) => [boxChildren(type)]),
    ...forEach(ADD_REMOVE_TYPES, () => [addRemoveChildren()]),
    GtkWidget: [
        container("controllers", "GtkEventController", CONTROLLER_METHODS),
        withBehavior<LayoutManagerHost, GObject.Object>(
            "GtkWidget",
            container("layoutManager", "GtkLayoutManager", { append: "setLayoutManager", remove: "setLayoutManager" }),
            {
                attach: (widget, manager) => widget.setLayoutManager(manager),
                detach: (widget) => widget.setLayoutManager(null),
            },
        ),
        withBehavior<ActionGroupHost, GObject.Object, ActionGroupPlacement>(
            "GtkWidget",
            container("actionGroups", "GActionGroup", {
                append: "insertActionGroup",
                remove: "insertActionGroup",
                childProps: ["prefix"],
            }),
            {
                attach: (widget, group, { props }) => widget.insertActionGroup(props.prefix ?? "", group),
                detach: (widget, _group, { props }) => widget.insertActionGroup(props.prefix ?? "", null),
            },
        ),
    ],
    GtkShortcutController: [container("shortcuts", "GtkShortcut", SHORTCUT_METHODS)],
    GtkTextView: [
        withBehavior<BufferHost, GObject.Object>(
            "GtkTextView",
            container("children", "GtkTextBuffer", { append: "setBuffer", remove: "setBuffer" }),
            {
                attach: (view, buffer) => view.setBuffer(buffer),
                detach: (view) => view.setBuffer(null),
            },
        ),
        container("children", "GtkWidget", { remove: "remove" }),
    ],
    GActionMap: [
        withBehavior<ActionMapLike, GObject.Object, ActionPlacement>(
            "GActionMap",
            container("actions", "GAction", { append: "addAction", remove: "removeAction" }),
            {
                attach: (map, action) => map.addAction(action),
                detach: (map, _action, { props }) => map.removeAction(props.name ?? ""),
            },
        ),
    ],
    GMenu: [
        withListBehavior<MenuLike, MenuItem>(
            "GMenu",
            { kind: "list", prop: "items", itemType: "MenuItem", clear: "removeAll", add: "append" },
            {
                clear: (menu) => menu.removeAll(),
                add: (menu, item) => appendMenuItem(menu, item),
            },
        ),
    ],
    GtkColumnView: [
        withBehavior<ColumnViewLike, GObject.Object>(
            "GtkColumnView",
            container("children", "GtkColumnViewColumn", {
                append: "appendColumn",
                remove: "removeColumn",
                insert: "insertColumn",
            }),
            {
                attach: (view, column) => view.appendColumn(column),
                detach: (view, column) => view.removeColumn(column),
                insert: (view, column, { index }) => view.insertColumn(index, column),
            },
        ),
    ],
    GtkGrid: [
        withBehavior<Gtk.Grid, Gtk.Widget>(
            "GtkGrid",
            container("children", "GtkWidget", { adopt: adopts("GtkGridLayoutChild") }),
            {
                attach: (grid, child) => grid.attach(child, 0, 0, 1, 1),
                detach: (grid, child) => grid.remove(child),
                resolve: layoutChild,
            },
        ),
    ],
    GtkFixed: [
        withBehavior<Gtk.Fixed, Gtk.Widget>(
            "GtkFixed",
            container("children", "GtkWidget", { adopt: adopts("GtkFixedLayoutChild") }),
            {
                attach: (fixed, child) => fixed.put(child, 0, 0),
                detach: (fixed, child) => fixed.remove(child),
                resolve: layoutChild,
            },
        ),
    ],
    GtkOverlay: [
        singleChild("GtkOverlay"),
        withBehavior<Gtk.Overlay, Gtk.Widget>(
            "GtkOverlay",
            container("overlays", "GtkWidget", { adopt: adopts("GtkOverlayLayoutChild") }),
            {
                attach: (overlay, child) => overlay.addOverlay(child),
                detach: (overlay, child) => overlay.removeOverlay(child),
                resolve: layoutChild,
            },
        ),
    ],
    GtkSizeGroup: [{ kind: "list", prop: "widgets", add: "addWidget", remove: "removeWidget" }],
    GtkConstraintLayout: [
        container("constraints", "GtkConstraint", { append: "addConstraint", remove: "removeConstraint" }),
        container("guides", "GtkConstraintGuide", { append: "addGuide", remove: "removeGuide" }),
        withListBehavior<ConstraintLayoutLike, VflConstraints>(
            "GtkConstraintLayout",
            { kind: "list", prop: "vfl", itemType: "VflConstraints", add: "addConstraintsFromDescription" },
            {
                add: (layout, item) => {
                    const added = layout.addConstraintsFromDescription(
                        item.lines,
                        item.hspacing ?? 0,
                        item.vspacing ?? 0,
                        item.views ?? new Map(),
                    );
                    vflConstraints.set(item, [...added]);
                },
                remove: (layout, item) => {
                    for (const constraint of vflConstraints.get(item) ?? []) layout.removeConstraint(constraint);
                    vflConstraints.delete(item);
                },
            },
        ),
    ],
    AdwShortcutsDialog: [container("children", "AdwShortcutsSection", { append: "add" })],
    AdwShortcutsSection: [container("children", "AdwShortcutsItem", { append: "add" })],
    AdwActionRow: prefixSuffixProps(),
    AdwEntryRow: prefixSuffixProps(),
    AdwExpanderRow: [
        ...prefixSuffixProps(),
        container("rows", "GtkWidget", { append: "addRow" }),
        container("actions", "GtkWidget", { append: "addAction" }),
    ],
    AdwHeaderBar: packProps(),
    GtkHeaderBar: packProps(),
    GtkActionBar: packProps(),
    AdwToolbarView: [
        container("topBar", "GtkWidget", { append: "addTopBar" }),
        container("bottomBar", "GtkWidget", { append: "addBottomBar" }),
        singleContent("AdwToolbarView"),
    ],
    AdwCarousel: [
        withBehavior<
            IndexedLike & {
                append: (child: Gtk.Widget) => void;
                reorder: (child: Gtk.Widget, position: number) => void;
            },
            Gtk.Widget
        >(
            "AdwCarousel",
            container("children", "GtkWidget", {
                append: "append",
                remove: "remove",
                insert: "insert",
                reorder: "reorder",
            }),
            {
                attach: (carousel, child) => carousel.append(child),
                detach: (carousel, child) => carousel.remove(child),
                insert: (carousel, child, { index }) => carousel.insert(child, index),
                reorder: (carousel, child, { index }) => carousel.reorder(child, index),
            },
        ),
    ],
    AdwPreferencesPage: [
        withBehavior<IndexedLike & { add: (child: Gtk.Widget) => void }, Gtk.Widget>(
            "AdwPreferencesPage",
            container("children", "GtkWidget", { append: "add", remove: "remove", insert: "insert" }),
            {
                attach: (page, child) => page.add(child),
                detach: (page, child) => page.remove(child),
                insert: (page, child, { index }) => page.insert(child, index),
            },
        ),
    ],
    AdwTabView: [
        withBehavior<TabViewLike, Gtk.Widget>(
            "AdwTabView",
            container("children", "GtkWidget", {
                append: "append",
                insert: "insert",
                reorder: "reorderPage",
                remove: "closePage",
                adopt: "getPage",
            }),
            {
                attach: (view, child) => view.append(child),
                insert: (view, child, { index }) => view.insert(child, index),
                reorder: (view, _child, { adopted, index }) => {
                    if (adopted !== null) view.reorderPage(adopted, index);
                },
                detach: (view, _child, { adopted }) => {
                    if (adopted !== null) view.closePage(adopted);
                },
                resolve: (view, child) => view.getPage(child),
            },
        ),
    ],
    GtkListBox: [autowrapChildren("GtkListBox", "GtkListBoxRow")],
    GtkFlowBox: [autowrapChildren("GtkFlowBox", "GtkFlowBoxChild")],
    GtkStack: [
        container("children", "GtkWidget", { append: "addChild", remove: "remove", adopt: true }),
        { kind: "lazy", prop: "visibleChildName", lookup: "getChildByName" },
    ],
    AdwViewStack: [
        container("children", "GtkWidget", { append: "add", remove: "remove", adopt: true }),
        { kind: "lazy", prop: "visibleChildName", lookup: "getChildByName" },
    ],
    GtkNotebook: [
        withBehavior<Gtk.Notebook, Gtk.Widget>(
            "GtkNotebook",
            container("children", "GtkWidget", { adopt: "getPage" }),
            {
                attach: (notebook, child) => notebook.appendPage(child, null),
                insert: (notebook, child, { index }) => notebook.insertPage(child, null, index),
                reorder: (notebook, child, { index }) => notebook.reorderChild(child, index),
                detach: (notebook, child) => notebook.detachTab(child),
                resolve: (notebook, child) => notebook.getPage(child),
            },
        ),
    ],
    AdwToggleGroup: [
        container("children", "AdwToggle", { append: "add", remove: "remove" }),
        { kind: "lazy", prop: "activeName", lookup: "getToggleByName" },
        { kind: "lazy", prop: "active" },
    ],
    GtkDropTarget: [{ kind: "value", prop: "types", call: "setGtypes" }],
    GtkDrawingArea: [{ kind: "value", prop: "drawFunc", call: "setDrawFunc", after: "queueDraw" }],
    GtkDragSource: [{ kind: "value", prop: "icon", call: "setIcon" }],
    GtkEditable: [{ kind: "controlled-text", prop: "text" }],
    GtkScale: [
        withListBehavior<ScaleLike, ScaleMark>(
            "GtkScale",
            { kind: "list", prop: "marks", add: "addMark", clear: "clearMarks" },
            {
                add: (scale, mark) => scale.addMark(mark.value ?? 0, mark.position, mark.markup ?? null),
                clear: (scale) => scale.clearMarks(),
            },
        ),
    ],
    GtkCalendar: [{ kind: "list", prop: "markedDays", add: "markDay", clear: "clearMarks" }],
    GtkLevelBar: [
        withListBehavior<LevelBarLike, LevelBarOffset>(
            "GtkLevelBar",
            { kind: "list", prop: "offsets", add: "addOffsetValue", remove: "removeOffsetValue" },
            {
                add: (bar, offset) => bar.addOffsetValue(offset.name, offset.value ?? 0),
                remove: (bar, offset) => bar.removeOffsetValue(offset.name),
            },
        ),
    ],
    GtkApplication: [
        container("children", "GtkWindow", { append: "addWindow", remove: "removeWindow" }),
        withListBehavior<AccelHost, ActionAccel>(
            "GtkApplication",
            { kind: "list", prop: "actionAccels", add: "setAccelsForAction", remove: "setAccelsForAction" },
            {
                add: (app, item) => app.setAccelsForAction(item.detailedActionName, item.accels),
                remove: (app, item) => app.setAccelsForAction(item.detailedActionName, []),
            },
        ),
    ],
    GtkAboutDialog: [
        withListBehavior<AboutDialogLike, CreditSection>(
            "GtkAboutDialog",
            { kind: "list", prop: "creditSections", add: "addCreditSection" },
            { add: (dialog, section) => dialog.addCreditSection(section.sectionName, section.people) },
        ),
    ],
    AdwAlertDialog: [
        withListBehavior<AlertDialogLike, AlertDialogResponse>(
            "AdwAlertDialog",
            {
                kind: "list",
                prop: "responses",
                itemKey: "id",
                add: ["addResponse", "setResponseAppearance", "setResponseEnabled"],
                remove: "removeResponse",
            },
            {
                add: (dialog, response) => {
                    dialog.addResponse(response.id, response.label);
                    if (response.appearance !== undefined) {
                        dialog.setResponseAppearance(response.id, response.appearance);
                    }
                    if (response.enabled !== undefined) dialog.setResponseEnabled(response.id, response.enabled);
                },
                remove: (dialog, response) => dialog.removeResponse(response.id),
            },
        ),
    ],
});

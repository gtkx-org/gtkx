/**
 * The reconciler's built-in data tables and their merge helpers.
 *
 * This module is pure data plus pure functions over that data: GLib type
 * names, method names, prop names, and finite condition vocabularies in the
 * row shapes declared by `@gtkx/config`. The React pipeline merges the
 * built-ins with the rows a project declares in `gtkx.config.ts` and emits
 * the result into the generated `@gtkx/jsx/metadata` module, which reaches
 * `@gtkx/react` through `virtual:gtkx-config` — the same channel as
 * `SIGNALS`/`CONSTRUCT_ONLY_PROPS`/`DEFAULT_PROPS`. The slot and array-prop
 * maps additionally shape the generated Props surfaces and compounds.
 *
 * Rows keyed by optional-namespace GLib type names (`"AdwToggleGroup"`,
 * `"AdwAlertDialog"`, …) are inert in projects that never load those
 * namespaces: no instance ever carries the GType, so the row never matches.
 */
import type { AddMethodRule, ArrayPropRow, ElementMapRule, PageMetaSetter, PropRule } from "@gtkx/config";

/**
 * Built-in attach relationships, interpreted by the reconciler's element map.
 * Project rows from `gtkx.config.ts` (`elementMap`) merge after these.
 */
export const BUILT_IN_ELEMENT_MAP: readonly ElementMapRule[] = [
    {
        child: "GtkEventController",
        parentType: "GtkWidget",
        verb: {
            kind: "method",
            attach: "addController",
            attachArgs: "child",
            detach: "removeController",
            detachArgs: "child",
            detachGuard: { side: "child", getter: "getWidget" },
        },
    },
    {
        child: "GtkLayoutManager",
        parentType: "GtkWidget",
        verb: {
            kind: "method",
            attach: "setLayoutManager",
            attachArgs: "child",
            detach: "setLayoutManager",
            detachArgs: "null",
            detachGuard: { side: "parent", getter: "getLayoutManager" },
        },
    },
    {
        child: "GtkShortcut",
        parentType: "GtkShortcutController",
        verb: {
            kind: "method",
            attach: "addShortcut",
            attachArgs: "child",
            detach: "removeShortcut",
            detachArgs: "child",
        },
    },
    {
        child: "GtkTextBuffer",
        parentType: "GtkTextView",
        verb: {
            kind: "method",
            attach: "setBuffer",
            attachArgs: "child",
            detach: "setBuffer",
            detachArgs: "null",
            detachGuard: { side: "parent", getter: "getBuffer" },
        },
    },
    {
        child: "GSimpleAction",
        parentMethod: "addAction",
        verb: {
            kind: "method",
            attach: "addAction",
            attachArgs: "child",
            detach: "removeAction",
            detachArgs: "childName",
        },
    },
    {
        child: "GSimpleActionGroup",
        parentType: "GtkWidget",
        verb: {
            kind: "method",
            attach: "insertActionGroup",
            attachArgs: "prefixChild",
            detach: "insertActionGroup",
            detachArgs: "prefixNull",
        },
    },
    {
        child: "GtkColumnViewColumn",
        parentType: "GtkColumnView",
        verb: {
            kind: "orderedInsert",
            attach: "insertColumn",
            detach: "removeColumn",
            collection: "getColumns",
        },
    },
    {
        child: "AdwToggle",
        parentType: "AdwToggleGroup",
        verb: {
            kind: "method",
            attach: "add",
            attachArgs: "child",
            detach: "remove",
            detachArgs: "child",
        },
    },
];

const POSITION_TYPE_BOTTOM = 3;

/**
 * Built-in array-valued props keyed by GLib type name, then by prop name.
 * Each row carries the item-type name its generated `Props` line declares
 * (an exported member of `@gtkx/react`) and the verbs the reconciler applies
 * per element. Project rows from `gtkx.config.ts` (`arrayProps`) merge over
 * these.
 */
export const BUILT_IN_ARRAY_PROPS: Readonly<Record<string, Readonly<Record<string, ArrayPropRow>>>> = {
    GtkScale: {
        marks: {
            itemType: "ScaleMark",
            clear: "clearMarks",
            add: [
                {
                    method: "addMark",
                    args: [
                        { kind: "item", path: "value" },
                        { kind: "item", path: "position", fallback: POSITION_TYPE_BOTTOM },
                        { kind: "item", path: "label", fallback: null },
                    ],
                },
            ],
        },
    },
    GtkLevelBar: {
        offsets: {
            itemType: "LevelBarOffset",
            remove: { method: "removeOffsetValue", args: [{ kind: "item", path: "id" }] },
            add: [
                {
                    method: "addOffsetValue",
                    args: [
                        { kind: "item", path: "id" },
                        { kind: "item", path: "value" },
                    ],
                },
            ],
        },
    },
    GtkCalendar: {
        markedDays: {
            itemType: "CalendarMark",
            clear: "clearMarks",
            add: [{ method: "markDay", args: [{ kind: "item" }] }],
        },
    },
    AdwAlertDialog: {
        responses: {
            itemType: "AlertDialogResponseProps",
            remove: { method: "removeResponse", args: [{ kind: "item", path: "id" }] },
            add: [
                {
                    method: "addResponse",
                    args: [
                        { kind: "item", path: "id" },
                        { kind: "item", path: "label" },
                    ],
                },
                {
                    method: "setResponseAppearance",
                    args: [
                        { kind: "item", path: "id" },
                        { kind: "item", path: "appearance" },
                    ],
                    when: { path: "appearance", is: "defined" },
                },
                {
                    method: "setResponseEnabled",
                    args: [
                        { kind: "item", path: "id" },
                        { kind: "item", path: "enabled" },
                    ],
                    when: { path: "enabled", is: "defined" },
                },
            ],
        },
    },
    GtkDropTarget: {
        types: { itemType: "DropTargetType", set: "setGtypes" },
    },
    GtkAboutDialog: {
        creditSections: {
            itemType: "CreditSection",
            appendOnce: true,
            add: [
                {
                    method: "addCreditSection",
                    args: [
                        { kind: "item", path: "name" },
                        { kind: "item", path: "people" },
                    ],
                },
            ],
        },
    },
};

const STACK_PAGE_RULE: PropRule = {
    kind: "setters",
    always: true,
    props: [
        {
            prop: "page",
            call: "setVisibleChildName",
            when: "truthy",
            skipWhenGetterEquals: "getVisibleChildName",
            requireGetterTruthyWithValue: "getChildByName",
        },
    ],
};

/**
 * Built-in imperative and signal prop rules keyed by GLib type name, merged
 * for every type in an instance's GType ancestry and interpreted by the
 * renderer's prop-descriptor layer.
 */
export const BUILT_IN_PROP_RULES: Readonly<Record<string, readonly PropRule[]>> = {
    AdwToggleGroup: [
        {
            kind: "setters",
            always: true,
            props: [
                { prop: "activeName", call: "setActiveName", when: "defined" },
                { prop: "active", call: "setActive", when: "nonNull" },
            ],
        },
    ],
    GtkStack: [STACK_PAGE_RULE],
    AdwViewStack: [STACK_PAGE_RULE],
    GtkTextTag: [
        {
            kind: "setters",
            props: [
                { prop: "priority", call: "setPriority", when: "nonNull" },
                { prop: "foreground", set: "foreground", when: "nonNull" },
                { prop: "background", set: "background", when: "nonNull" },
                { prop: "paragraphBackground", set: "paragraphBackground", when: "nonNull" },
            ],
        },
    ],
    GtkWindow: [{ kind: "signal", prop: "onClose", signal: "close-request", noArgs: true, returnValue: true }],
};

/**
 * GLib type names of top-level surfaces: widgets that never attach as a
 * parent's widget child and present on their own (windows and dialogs).
 */
export const TOP_LEVEL_TYPES: readonly string[] = ["GtkWindow", "AdwDialog"];

/**
 * Page-add method selection for stack-like parents, keyed by GLib type name
 * in priority order: the first rule whose `requires` are all satisfied wins.
 * The returned page handle is held by the meta-object interpreter, which
 * applies {@link PAGE_META_SETTERS} to it on every reconcile.
 */
export const META_OBJECT_ADD_METHODS: Readonly<Record<string, readonly AddMethodRule[]>> = {
    AdwViewStack: [
        { method: "addTitledWithIcon", args: ["widget", "id", "title", "iconName"], requires: ["title", "iconName"] },
        { method: "addTitled", args: ["widget", "id", "title"], requires: ["title"] },
        { method: "addNamed", args: ["widget", "id"], requires: ["id"] },
        { method: "add", args: ["widget"], requires: [] },
    ],
    GtkStack: [
        { method: "addTitled", args: ["widget", "id", "title"], requires: ["title"] },
        { method: "addNamed", args: ["widget", "id"], requires: ["id"] },
        { method: "addChild", args: ["widget"], requires: [] },
    ],
};

/**
 * Page-metadata setters applied to stack page handles. Setters a page handle
 * lacks are skipped, so namespace-specific rows (`setBadgeNumber` exists only
 * on `Adw.ViewStackPage`) are inert elsewhere.
 */
export const PAGE_META_SETTERS: readonly PageMetaSetter[] = [
    { setter: "setTitle", prop: "title", whenPresent: true },
    { setter: "setIconName", prop: "iconName", whenPresent: true },
    { setter: "setNeedsAttention", prop: "needsAttention", fallback: false },
    { setter: "setVisible", prop: "visible", fallback: true },
    { setter: "setUseUnderline", prop: "useUnderline", fallback: false },
    { setter: "setBadgeNumber", prop: "badgeNumber", whenPresent: true },
];

/**
 * Built-in widget-typed properties exposed as JSX child slots (typed as
 * `ReactNode`, setter semantics), keyed by JSX element name with camelCase
 * property-name values. Project entries from `gtkx.config.ts` (`slots`)
 * merge into this map.
 */
export const BUILT_IN_SLOTS: Readonly<Record<string, readonly string[]>> = Object.freeze({
    GtkWindow: ["titlebar"],
    AdwWindow: ["content"],
    AdwApplicationWindow: ["content"],
    AdwAlertDialog: ["extraChild"],
    AdwBottomSheet: ["bottomBar", "content", "sheet"],
    GtkCenterBox: ["centerWidget", "endWidget", "startWidget"],
    GtkColumnViewColumn: ["headerMenu"],
    GtkExpander: ["labelWidget"],
    AdwFlap: ["content", "flap", "separator"],
    GtkFrame: ["labelWidget"],
    GtkHeaderBar: ["titleWidget"],
    AdwHeaderBar: ["titleWidget"],
    GtkMenuButton: ["menuModel", "popover"],
    AdwMessageDialog: ["extraChild"],
    AdwNavigationSplitView: ["content", "sidebar"],
    AdwOverlaySplitView: ["content", "sidebar"],
    GtkPaned: ["endChild", "startChild"],
    GtkPopoverMenu: ["menuModel"],
    GtkPopoverMenuBar: ["menuModel"],
    AdwPreferencesGroup: ["headerSuffix"],
    AdwPreferencesPage: ["banner"],
    AdwSplitButton: ["popover"],
    AdwTabBar: ["endActionWidget", "startActionWidget"],
    AdwToolbarView: ["content"],
});

/**
 * Built-in container-slot method names — the camelCase GTK methods that
 * append a child onto the widget — keyed by JSX element name. Each method
 * name doubles as a `ReactNode` prop on the compound and as the
 * `<ContainerSlot id="…">` identifier the reconciler dispatches to. Project
 * entries from `gtkx.config.ts` (`containerSlots`) merge into this map.
 */
export const BUILT_IN_CONTAINER_SLOTS: Readonly<Record<string, readonly string[]>> = Object.freeze({
    AdwActionRow: ["addPrefix", "addSuffix"],
    AdwEntryRow: ["addPrefix", "addSuffix"],
    AdwExpanderRow: ["addPrefix", "addSuffix", "addRow", "addAction"],
    AdwHeaderBar: ["packStart", "packEnd"],
    AdwToolbarView: ["addTopBar", "addBottomBar"],
    GtkActionBar: ["packStart", "packEnd"],
    GtkHeaderBar: ["packStart", "packEnd"],
});

const mergeSlotMap = (
    builtIn: Readonly<Record<string, readonly string[]>>,
    userSlots: Readonly<Record<string, readonly string[]>> | undefined,
): Readonly<Record<string, readonly string[]>> => {
    const result: Record<string, string[]> = {};
    for (const [key, values] of Object.entries(builtIn)) {
        result[key] = [...values];
    }
    if (userSlots !== undefined) {
        for (const [key, values] of Object.entries(userSlots)) {
            const merged = new Set<string>(result[key] ?? []);
            for (const value of values) merged.add(value);
            result[key] = [...merged].sort((a, b) => a.localeCompare(b));
        }
    }
    return result;
};

/**
 * Merges the built-in widget slots with a project's `slots` map: an
 * overridden element becomes the union of both sources with duplicates
 * removed and a stable alphabetical sort; untouched elements keep their
 * built-in declaration order.
 *
 * @param userSlots - The project's `slots` map, or `undefined`
 */
export const mergeSlots = (
    userSlots: Readonly<Record<string, readonly string[]>> | undefined,
): Readonly<Record<string, readonly string[]>> => mergeSlotMap(BUILT_IN_SLOTS, userSlots);

/**
 * Merges the built-in container slots with a project's `containerSlots` map,
 * with the same union semantics as {@link mergeSlots}.
 *
 * @param userContainerSlots - The project's `containerSlots` map, or `undefined`
 */
export const mergeContainerSlots = (
    userContainerSlots: Readonly<Record<string, readonly string[]>> | undefined,
): Readonly<Record<string, readonly string[]>> => mergeSlotMap(BUILT_IN_CONTAINER_SLOTS, userContainerSlots);

/**
 * Merges the built-in array-prop rows with a project's `arrayProps` map: per
 * element, the project's prop-to-row object is spread over the built-in one,
 * so project entries add new props or replace an existing prop's row.
 *
 * @param userArrayProps - The project's `arrayProps` map, or `undefined`
 */
export const mergeArrayProps = (
    userArrayProps: Readonly<Record<string, Readonly<Record<string, ArrayPropRow>>>> | undefined,
): Readonly<Record<string, Readonly<Record<string, ArrayPropRow>>>> => {
    const result: Record<string, Readonly<Record<string, ArrayPropRow>>> = {};
    for (const [key, props] of Object.entries(BUILT_IN_ARRAY_PROPS)) {
        result[key] = { ...props };
    }
    if (userArrayProps !== undefined) {
        for (const [key, props] of Object.entries(userArrayProps)) {
            result[key] = { ...result[key], ...props };
        }
    }
    return result;
};

/**
 * Merges the built-in element-map rows with a project's `elementMap` rows,
 * built-ins first so specific built-in relationships keep precedence.
 *
 * @param userElementMap - The project's `elementMap` rows, or `undefined`
 */
export const mergeElementMap = (userElementMap: readonly ElementMapRule[] | undefined): readonly ElementMapRule[] =>
    userElementMap === undefined || userElementMap.length === 0
        ? BUILT_IN_ELEMENT_MAP
        : [...BUILT_IN_ELEMENT_MAP, ...userElementMap];

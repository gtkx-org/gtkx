import type {
    AddMethodRule,
    ArrayPropRow,
    ContainerPropRow,
    ElementMapRule,
    ObjectPropRow,
    PageMetaSetter,
    PerElementPropRows,
    PropRule,
    VirtualPropRow,
} from "@gtkx/config";

export const BUILT_IN_ELEMENT_MAP: ElementMapRule[] = [
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

export type CompoundHoc = "withTopLevel" | "withApplication" | "withApplicationWindow";

export type CompoundHocRule = { ancestors: string[]; hoc: CompoundHoc };

export const BUILT_IN_COMPOUND_HOCS: CompoundHocRule[] = [
    { ancestors: ["GtkApplication"], hoc: "withApplication" },
    { ancestors: ["GtkApplicationWindow"], hoc: "withApplicationWindow" },
    { ancestors: ["GtkWindow", "AdwDialog"], hoc: "withTopLevel" },
];

const POSITION_TYPE_BOTTOM = 3;

export const BUILT_IN_ARRAY_PROPS: PerElementPropRows<ArrayPropRow> = {
    GtkApplication: {
        actionAccels: {
            itemType: "ActionAccel",
            remove: {
                method: "setAccelsForAction",
                args: [
                    { kind: "item", path: "action" },
                    { kind: "value", value: [] },
                ],
            },
            add: [
                {
                    method: "setAccelsForAction",
                    args: [
                        { kind: "item", path: "action" },
                        { kind: "item", path: "accels" },
                    ],
                },
            ],
        },
    },
    GtkSizeGroup: {
        widgets: {
            itemType: "Gtk.Widget",
            remove: { method: "removeWidget", args: [{ kind: "item" }] },
            add: [{ method: "addWidget", args: [{ kind: "item" }] }],
        },
    },
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

export const BUILT_IN_OBJECT_PROPS: PerElementPropRows<ObjectPropRow> = {
    GtkDragSource: {
        icon: {
            itemType: "DragSourceIcon",
            set: [
                {
                    method: "setIcon",
                    args: [
                        { kind: "item", path: "paintable" },
                        { kind: "item", path: "hotX", fallback: 0 },
                        { kind: "item", path: "hotY", fallback: 0 },
                    ],
                },
            ],
            unset: [
                {
                    method: "setIcon",
                    args: [
                        { kind: "value", value: null },
                        { kind: "value", value: 0 },
                        { kind: "value", value: 0 },
                    ],
                },
            ],
        },
    },
};

export const BUILT_IN_VIRTUAL_PROPS: PerElementPropRows<VirtualPropRow> = {
    GtkDrawingArea: {
        drawFunc: { type: "Gtk.DrawingAreaDrawFunc", setter: "setDrawFunc", after: "queueDraw" },
    },
};

const STACK_PAGE_RULE: PropRule = {
    kind: "setters",
    always: true,
    props: [
        {
            prop: "visibleChildName",
            call: "setVisibleChildName",
            when: "truthy",
            skipWhenGetterEquals: "getVisibleChildName",
            requireGetterTruthyWithValue: "getChildByName",
        },
    ],
};

export const BUILT_IN_PROP_RULES: Record<string, PropRule[]> = {
    GtkEditable: [
        {
            kind: "setters",
            props: [{ prop: "text", set: "text", skipWhenGetterDivergedFromCommitted: "getText" }],
        },
    ],
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
};

export const TOP_LEVEL_TYPES: string[] = ["GtkWindow", "AdwDialog"];

export const DEFAULT_BLOCKABLE_TYPES: string[] = ["GtkTextBuffer"];

export const META_OBJECT_ADD_METHODS: Record<string, AddMethodRule[]> = {
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

export const PAGE_META_SETTERS: PageMetaSetter[] = [
    { setter: "setTitle", prop: "title", whenPresent: true },
    { setter: "setIconName", prop: "iconName", whenPresent: true },
    { setter: "setNeedsAttention", prop: "needsAttention", fallback: false },
    { setter: "setVisible", prop: "visible", fallback: true },
    { setter: "setUseUnderline", prop: "useUnderline", fallback: false },
    { setter: "setBadgeNumber", prop: "badgeNumber", whenPresent: true },
];

const PREFIX_SUFFIX_PROPS: Record<string, ContainerPropRow> = {
    prefix: { attach: "addPrefix" },
    suffix: { attach: "addSuffix" },
};

const PACK_PROPS: Record<string, ContainerPropRow> = {
    start: { attach: "packStart" },
    end: { attach: "packEnd" },
};

export const BUILT_IN_CONTAINER_PROPS: PerElementPropRows<ContainerPropRow> = {
    GtkWidget: {
        controllers: {
            attach: "addController",
            detach: "removeController",
            detachGuard: { side: "child", getter: "getWidget" },
        },
        actionGroups: {
            attach: "insertActionGroup",
            attachArgs: "prefixChild",
            detach: "insertActionGroup",
            detachArgs: "prefixNull",
        },
    },
    GtkShortcutController: { shortcuts: { attach: "addShortcut", detach: "removeShortcut" } },
    GtkApplicationWindow: { actions: { attach: "addAction", detach: "removeAction", detachArgs: "childName" } },
    AdwActionRow: PREFIX_SUFFIX_PROPS,
    AdwEntryRow: PREFIX_SUFFIX_PROPS,
    AdwExpanderRow: { ...PREFIX_SUFFIX_PROPS, rows: { attach: "addRow" }, actions: { attach: "addAction" } },
    AdwHeaderBar: PACK_PROPS,
    AdwToolbarView: { topBar: { attach: "addTopBar" }, bottomBar: { attach: "addBottomBar" } },
    GtkActionBar: PACK_PROPS,
    GtkHeaderBar: PACK_PROPS,
};

export const BUILT_IN_PROPS_MIXINS: Record<string, string[]> = Object.freeze({
    GMenu: ["MenuItemsProps"],
    GSimpleActionGroup: ["ActionGroupPrefixProps"],
});

export const WIDGET_BASE_PROPS_MIXINS: string[] = ["AccessibleProps"];

const mergePropRowMap = <Row>(
    builtIn: PerElementPropRows<Row>,
    userRows: PerElementPropRows<Row> | undefined,
): PerElementPropRows<Row> => {
    const result: Record<string, Record<string, Row>> = {};
    for (const [key, props] of Object.entries(builtIn)) {
        result[key] = { ...props };
    }
    if (userRows !== undefined) {
        for (const [key, props] of Object.entries(userRows)) {
            result[key] = { ...result[key], ...props };
        }
    }
    return result;
};

export const mergeContainerProps = (
    userContainerProps: PerElementPropRows<ContainerPropRow> | undefined,
): PerElementPropRows<ContainerPropRow> => mergePropRowMap(BUILT_IN_CONTAINER_PROPS, userContainerProps);

export const mergeArrayProps = (
    userArrayProps: PerElementPropRows<ArrayPropRow> | undefined,
): PerElementPropRows<ArrayPropRow> => mergePropRowMap(BUILT_IN_ARRAY_PROPS, userArrayProps);

export const mergeObjectProps = (
    userObjectProps: PerElementPropRows<ObjectPropRow> | undefined,
): PerElementPropRows<ObjectPropRow> => mergePropRowMap(BUILT_IN_OBJECT_PROPS, userObjectProps);

export const mergeVirtualProps = (
    userVirtualProps: PerElementPropRows<VirtualPropRow> | undefined,
): PerElementPropRows<VirtualPropRow> => mergePropRowMap(BUILT_IN_VIRTUAL_PROPS, userVirtualProps);

export const mergeElementMap = (userElementMap: ElementMapRule[] | undefined): ElementMapRule[] =>
    userElementMap === undefined || userElementMap.length === 0
        ? BUILT_IN_ELEMENT_MAP
        : [...BUILT_IN_ELEMENT_MAP, ...userElementMap];

export type RuntimeComponentWrapper =
    | { kind: "reexport" }
    | { kind: "typedProps" }
    | {
          kind: "typed";
          genericParams: string;
          omitKeys?: string;
          controllerProps: string;
          sharedTypes: string[];
      };

export type WidgetOverride = {
    wrapper?: RuntimeComponentWrapper;
    runtimeOwned?: boolean;
    excludedProps?: Set<string>;
};

export const WIDGET_OVERRIDES: Record<string, WidgetOverride> = {
    GtkListView: {
        wrapper: {
            kind: "typed",
            genericParams: "<T = unknown, S = unknown>",
            controllerProps: "ListViewProps<T, S>",
            sharedTypes: ["ListViewProps"],
        },
    },
    GtkGridView: {
        wrapper: {
            kind: "typed",
            genericParams: "<T = unknown>",
            controllerProps: "GridViewProps<T>",
            sharedTypes: ["GridViewProps"],
        },
    },
    GtkDropDown: {
        wrapper: {
            kind: "typed",
            genericParams: "<T = unknown, S = unknown>",
            controllerProps: "DropDownProps<T, S>",
            sharedTypes: ["DropDownProps"],
        },
    },
    AdwComboRow: {
        wrapper: {
            kind: "typed",
            genericParams: "<T = unknown, S = unknown>",
            controllerProps: "DropDownProps<T, S>",
            sharedTypes: ["DropDownProps"],
        },
    },
    GtkColumnView: {
        wrapper: {
            kind: "typed",
            genericParams: "<T = unknown, S = unknown>",
            controllerProps: "ColumnViewProps<T, S>",
            sharedTypes: ["ColumnViewProps"],
        },
        excludedProps: new Set(["columns"]),
    },
    GtkColumnViewColumn: {
        wrapper: {
            kind: "typed",
            genericParams: "<T = unknown>",
            omitKeys: '"factory" | "sorter"',
            controllerProps: "ColumnViewColumnProps<T>",
            sharedTypes: ["ColumnViewColumnProps"],
        },
    },
    GMenu: { wrapper: { kind: "typedProps" } },
    GtkConstraintLayout: { wrapper: { kind: "reexport" } },
    GMenuItem: { runtimeOwned: true },
    AdwSpringAnimation: { runtimeOwned: true },
    AdwTimedAnimation: { runtimeOwned: true },
};

export const widgetWrapper = (glibName: string): RuntimeComponentWrapper | undefined =>
    WIDGET_OVERRIDES[glibName]?.wrapper;

export const excludedPropsForWidget = (glibName: string): Set<string> | undefined =>
    WIDGET_OVERRIDES[glibName]?.excludedProps;

export const RUNTIME_OWNED_WIDGETS: Set<string> = new Set(
    Object.entries(WIDGET_OVERRIDES)
        .filter(([, override]) => override.runtimeOwned === true || override.wrapper !== undefined)
        .map(([glibName]) => glibName),
);

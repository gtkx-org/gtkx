import type { RuleContext, RuleRegistry, RuleSet } from "@gtkx/config";
import { callMethod } from "@gtkx/utils";

const POSITION_TYPE_BOTTOM = 3;

const nameOf = (instance: object): string => {
    const value = callMethod(instance, "getName", []);
    return typeof value === "string" ? value : "";
};

const changed = (oldValue: unknown, newValue: unknown): boolean => oldValue !== newValue;

const asArray = <T>(value: unknown): T[] => (Array.isArray(value) ? (value as T[]) : []);

const attachShortcut = (parent: object, child: object, ctx: RuleContext): void => {
    if (ctx.instanceIsA(parent, "GtkShortcutController") && ctx.instanceIsA(child, "GtkShortcut")) {
        callMethod(parent, "addShortcut", [child]);
    }
};

const detachShortcut = (parent: object, child: object, ctx: RuleContext): void => {
    if (ctx.instanceIsA(parent, "GtkShortcutController") && ctx.instanceIsA(child, "GtkShortcut")) {
        callMethod(parent, "removeShortcut", [child]);
    }
};

const EventController: RuleSet = {
    appendChild: (parent, child, ctx) => {
        if (ctx.instanceIsA(parent.instance, "GtkWidget") && ctx.instanceIsA(child.instance, "GtkEventController")) {
            callMethod(parent.instance, "addController", [child.instance]);
        }
    },
    removeChild: (parent, child, ctx) => {
        if (
            ctx.instanceIsA(parent.instance, "GtkWidget") &&
            ctx.instanceIsA(child.instance, "GtkEventController") &&
            callMethod(child.instance, "getWidget", []) === parent.instance
        ) {
            callMethod(parent.instance, "removeController", [child.instance]);
        }
    },
};

const LayoutManager: RuleSet = {
    appendChild: (parent, child, ctx) => {
        if (ctx.instanceIsA(parent.instance, "GtkWidget") && ctx.instanceIsA(child.instance, "GtkLayoutManager")) {
            callMethod(parent.instance, "setLayoutManager", [child.instance]);
        }
    },
    removeChild: (parent, child, ctx) => {
        if (
            ctx.instanceIsA(parent.instance, "GtkWidget") &&
            callMethod(parent.instance, "getLayoutManager", []) === child.instance
        ) {
            callMethod(parent.instance, "setLayoutManager", [null]);
        }
    },
};

const Shortcut: RuleSet = {
    appendChild: (parent, child, ctx) => attachShortcut(parent.instance, child.instance, ctx),
    removeChild: (parent, child, ctx) => detachShortcut(parent.instance, child.instance, ctx),
};

const TextBuffer: RuleSet = {
    appendChild: (parent, child, ctx) => {
        if (ctx.instanceIsA(parent.instance, "GtkTextView") && ctx.instanceIsA(child.instance, "GtkTextBuffer")) {
            callMethod(parent.instance, "setBuffer", [child.instance]);
        }
    },
    removeChild: (parent, child, ctx) => {
        if (
            ctx.instanceIsA(parent.instance, "GtkTextView") &&
            callMethod(parent.instance, "getBuffer", []) === child.instance
        ) {
            callMethod(parent.instance, "setBuffer", [null]);
        }
    },
};

const SimpleAction: RuleSet = {
    appendChild: (parent, child) => {
        if (typeof Reflect.get(parent.instance, "addAction") === "function") {
            callMethod(parent.instance, "addAction", [child.instance]);
        }
    },
    removeChild: (parent, child) => {
        if (typeof Reflect.get(parent.instance, "removeAction") === "function") {
            callMethod(parent.instance, "removeAction", [nameOf(child.instance)]);
        }
    },
};

const SimpleActionGroup: RuleSet = {
    appendChild: (parent, child, ctx) => {
        const prefix = child.props.prefix;
        if (
            ctx.instanceIsA(parent.instance, "GtkWidget") &&
            ctx.instanceIsA(child.instance, "GActionGroup") &&
            typeof prefix === "string"
        ) {
            callMethod(parent.instance, "insertActionGroup", [prefix, child.instance]);
        }
    },
    removeChild: (parent, child, ctx) => {
        const prefix = child.props.prefix;
        if (ctx.instanceIsA(parent.instance, "GtkWidget") && typeof prefix === "string") {
            callMethod(parent.instance, "insertActionGroup", [prefix, null]);
        }
    },
};

const ColumnViewColumn: RuleSet = {
    appendChild: (parent, child, ctx) => {
        if (
            ctx.instanceIsA(parent.instance, "GtkColumnView") &&
            ctx.instanceIsA(child.instance, "GtkColumnViewColumn")
        ) {
            callMethod(parent.instance, "appendColumn", [child.instance]);
        }
    },
    removeChild: (parent, child, ctx) => {
        if (
            ctx.instanceIsA(parent.instance, "GtkColumnView") &&
            ctx.instanceIsA(child.instance, "GtkColumnViewColumn")
        ) {
            callMethod(parent.instance, "removeColumn", [child.instance]);
        }
    },
};

const Toggle: RuleSet = {
    appendChild: (parent, child, ctx) => {
        if (ctx.instanceIsA(parent.instance, "AdwToggleGroup") && ctx.instanceIsA(child.instance, "AdwToggle")) {
            callMethod(parent.instance, "add", [child.instance]);
        }
    },
    removeChild: (parent, child, ctx) => {
        if (ctx.instanceIsA(parent.instance, "AdwToggleGroup") && ctx.instanceIsA(child.instance, "AdwToggle")) {
            callMethod(parent.instance, "remove", [child.instance]);
        }
    },
};

const ShortcutsSection: RuleSet = {
    appendChild: (parent, child, ctx) => {
        if (
            ctx.instanceIsA(parent.instance, "AdwShortcutsDialog") &&
            ctx.instanceIsA(child.instance, "AdwShortcutsSection")
        ) {
            callMethod(parent.instance, "add", [child.instance]);
        }
    },
};

const ShortcutsItem: RuleSet = {
    appendChild: (parent, child, ctx) => {
        if (
            ctx.instanceIsA(parent.instance, "AdwShortcutsSection") &&
            ctx.instanceIsA(child.instance, "AdwShortcutsItem")
        ) {
            callMethod(parent.instance, "add", [child.instance]);
        }
    },
};

type SlotAttach = (parent: object, child: object) => void;

const reflectAdd =
    (method: string): SlotAttach =>
    (parent, child) => {
        callMethod(parent, method, [child]);
    };

const slots = (table: Record<string, SlotAttach>): RuleSet => ({
    appendChild: (parent, child) => {
        const attach = child.slotTag ? table[child.slotTag] : undefined;
        if (attach) attach(parent.instance, child.instance);
    },
});

const PREFIX_SUFFIX: Record<string, SlotAttach> = {
    prefix: reflectAdd("addPrefix"),
    suffix: reflectAdd("addSuffix"),
};

const PACK: Record<string, SlotAttach> = {
    start: reflectAdd("packStart"),
    end: reflectAdd("packEnd"),
};

const ActionRow = slots(PREFIX_SUFFIX);
const EntryRow = slots(PREFIX_SUFFIX);
const ExpanderRow = slots({
    ...PREFIX_SUFFIX,
    rows: reflectAdd("addRow"),
    actions: reflectAdd("addAction"),
});
const HeaderBar = slots(PACK);
const ToolbarView = slots({
    topBar: reflectAdd("addTopBar"),
    bottomBar: reflectAdd("addBottomBar"),
});
const ActionBar = slots(PACK);

const Widget: RuleSet = {
    appendChild: (parent, child, ctx) => {
        if (!ctx.instanceIsA(parent.instance, "GtkWidget")) return;
        if (child.slotTag === "controllers" && ctx.instanceIsA(child.instance, "GtkEventController")) {
            callMethod(parent.instance, "addController", [child.instance]);
        } else if (
            child.slotTag === "actionGroups" &&
            ctx.instanceIsA(child.instance, "GActionGroup") &&
            typeof child.props.prefix === "string"
        ) {
            callMethod(parent.instance, "insertActionGroup", [child.props.prefix, child.instance]);
        }
    },
    removeChild: (parent, child, ctx) => {
        if (!ctx.instanceIsA(parent.instance, "GtkWidget")) return;
        if (
            child.slotTag === "controllers" &&
            ctx.instanceIsA(child.instance, "GtkEventController") &&
            callMethod(child.instance, "getWidget", []) === parent.instance
        ) {
            callMethod(parent.instance, "removeController", [child.instance]);
        } else if (child.slotTag === "actionGroups" && typeof child.props.prefix === "string") {
            callMethod(parent.instance, "insertActionGroup", [child.props.prefix, null]);
        }
    },
};

const ShortcutController: RuleSet = {
    appendChild: (parent, child, ctx) => {
        if (child.slotTag === "shortcuts") attachShortcut(parent.instance, child.instance, ctx);
    },
    removeChild: (parent, child, ctx) => {
        if (child.slotTag === "shortcuts") detachShortcut(parent.instance, child.instance, ctx);
    },
};

const ApplicationWindow: RuleSet = {
    appendChild: (parent, child) => {
        if (child.slotTag === "actions" && typeof Reflect.get(parent.instance, "addAction") === "function") {
            callMethod(parent.instance, "addAction", [child.instance]);
        }
    },
    removeChild: (parent, child) => {
        if (child.slotTag === "actions" && typeof Reflect.get(parent.instance, "removeAction") === "function") {
            callMethod(parent.instance, "removeAction", [nameOf(child.instance)]);
        }
    },
};

type ActionAccelItem = {
    action: string;
    accels: string[];
};

const Application: RuleSet = {
    setProps: (node, newProps, oldProps, ctx) => {
        if (
            !ctx.instanceIsA(node.instance, "GtkApplication") ||
            !changed(oldProps?.actionAccels, newProps.actionAccels)
        ) {
            return;
        }
        for (const accel of asArray<ActionAccelItem>(oldProps?.actionAccels)) {
            callMethod(node.instance, "setAccelsForAction", [accel.action, []]);
        }
        for (const accel of asArray<ActionAccelItem>(newProps.actionAccels)) {
            callMethod(node.instance, "setAccelsForAction", [accel.action, accel.accels]);
        }
    },
};

const SizeGroup: RuleSet = {
    setProps: (node, newProps, oldProps, ctx) => {
        if (!ctx.instanceIsA(node.instance, "GtkSizeGroup") || !changed(oldProps?.widgets, newProps.widgets)) return;
        for (const widget of asArray<object>(oldProps?.widgets)) callMethod(node.instance, "removeWidget", [widget]);
        for (const widget of asArray<object>(newProps.widgets)) callMethod(node.instance, "addWidget", [widget]);
    },
};

type ScaleMarkItem = {
    value: number;
    position?: number;
    label?: string | null;
};

const Scale: RuleSet = {
    setProps: (node, newProps, oldProps, ctx) => {
        if (!ctx.instanceIsA(node.instance, "GtkScale") || !changed(oldProps?.marks, newProps.marks)) return;
        callMethod(node.instance, "clearMarks", []);
        for (const mark of asArray<ScaleMarkItem>(newProps.marks)) {
            callMethod(node.instance, "addMark", [
                mark.value,
                mark.position ?? POSITION_TYPE_BOTTOM,
                mark.label ?? null,
            ]);
        }
    },
};

type LevelBarOffsetItem = {
    id: string;
    value: number;
};

const LevelBar: RuleSet = {
    setProps: (node, newProps, oldProps, ctx) => {
        if (!ctx.instanceIsA(node.instance, "GtkLevelBar") || !changed(oldProps?.offsets, newProps.offsets)) return;
        for (const offset of asArray<LevelBarOffsetItem>(oldProps?.offsets)) {
            callMethod(node.instance, "removeOffsetValue", [offset.id]);
        }
        for (const offset of asArray<LevelBarOffsetItem>(newProps.offsets)) {
            callMethod(node.instance, "addOffsetValue", [offset.id, offset.value]);
        }
    },
};

const Calendar: RuleSet = {
    setProps: (node, newProps, oldProps, ctx) => {
        if (!ctx.instanceIsA(node.instance, "GtkCalendar") || !changed(oldProps?.markedDays, newProps.markedDays)) {
            return;
        }
        callMethod(node.instance, "clearMarks", []);
        for (const day of asArray<number>(newProps.markedDays)) callMethod(node.instance, "markDay", [day]);
    },
};

type AlertResponseItem = {
    id: string;
    label: string;
    appearance?: number;
    enabled?: boolean;
};

const AlertDialog: RuleSet = {
    setProps: (node, newProps, oldProps, ctx) => {
        if (!ctx.instanceIsA(node.instance, "AdwAlertDialog") || !changed(oldProps?.responses, newProps.responses)) {
            return;
        }
        for (const response of asArray<AlertResponseItem>(oldProps?.responses)) {
            callMethod(node.instance, "removeResponse", [response.id]);
        }
        for (const response of asArray<AlertResponseItem>(newProps.responses)) {
            callMethod(node.instance, "addResponse", [response.id, response.label]);
            if (response.appearance !== undefined) {
                callMethod(node.instance, "setResponseAppearance", [response.id, response.appearance]);
            }
            if (response.enabled !== undefined) {
                callMethod(node.instance, "setResponseEnabled", [response.id, response.enabled]);
            }
        }
    },
};

const DropTarget: RuleSet = {
    setProps: (node, newProps, oldProps, ctx) => {
        if (!ctx.instanceIsA(node.instance, "GtkDropTarget") || !changed(oldProps?.types, newProps.types)) return;
        callMethod(node.instance, "setGtypes", [asArray<bigint>(newProps.types)]);
    },
};

type CreditSectionItem = {
    name: string;
    people: string[];
};

const AboutDialog: RuleSet = {
    setProps: (node, newProps, oldProps, ctx) => {
        if (
            !ctx.instanceIsA(node.instance, "GtkAboutDialog") ||
            !changed(oldProps?.creditSections, newProps.creditSections)
        ) {
            return;
        }
        if (asArray<CreditSectionItem>(oldProps?.creditSections).length !== 0) return;
        for (const section of asArray<CreditSectionItem>(newProps.creditSections)) {
            callMethod(node.instance, "addCreditSection", [section.name, section.people]);
        }
    },
};

type DragSourceIconItem = {
    paintable: object;
    hotX?: number;
    hotY?: number;
};

const DragSource: RuleSet = {
    setProps: (node, newProps, oldProps, ctx) => {
        if (!ctx.instanceIsA(node.instance, "GtkDragSource") || !changed(oldProps?.icon, newProps.icon)) return;
        const icon = newProps.icon;
        if (icon == null) {
            callMethod(node.instance, "setIcon", [null, 0, 0]);
            return;
        }
        const value = icon as DragSourceIconItem;
        callMethod(node.instance, "setIcon", [value.paintable, value.hotX ?? 0, value.hotY ?? 0]);
    },
};

const DrawingArea: RuleSet = {
    setProps: (node, newProps, oldProps, ctx) => {
        if (!ctx.instanceIsA(node.instance, "GtkDrawingArea") || !changed(oldProps?.drawFunc, newProps.drawFunc)) {
            return;
        }
        const drawFunc = newProps.drawFunc;
        callMethod(node.instance, "setDrawFunc", [typeof drawFunc === "function" ? drawFunc : null]);
        callMethod(node.instance, "queueDraw", []);
    },
};

const Editable: RuleSet = {
    setProps: (node, newProps, oldProps, ctx) => {
        if (!ctx.instanceIsA(node.instance, "GtkEditable")) return;
        const value = newProps.text;
        if (!changed(oldProps?.text, value) || typeof value !== "string") return;
        const committed = oldProps?.text;
        if (committed !== undefined && callMethod(node.instance, "getText", []) !== committed) return;
        Reflect.set(node.instance, "text", value);
    },
};

const applyStackPage = (instance: object, newProps: Record<string, unknown>): void => {
    const value = newProps.visibleChildName;
    if (typeof value !== "string" || value === "") return;
    if (callMethod(instance, "getVisibleChildName", []) !== value && callMethod(instance, "getChildByName", [value])) {
        callMethod(instance, "setVisibleChildName", [value]);
    }
};

const Stack: RuleSet = {
    setProps: (node, newProps, _oldProps, ctx) => {
        if (ctx.instanceIsA(node.instance, "GtkStack")) applyStackPage(node.instance, newProps);
    },
};

const ViewStack: RuleSet = {
    setProps: (node, newProps, _oldProps, ctx) => {
        if (ctx.instanceIsA(node.instance, "AdwViewStack")) applyStackPage(node.instance, newProps);
    },
};

const ToggleGroup: RuleSet = {
    setProps: (node, newProps, _oldProps, ctx) => {
        if (!ctx.instanceIsA(node.instance, "AdwToggleGroup")) return;
        const activeName = newProps.activeName;
        if (activeName !== undefined) {
            callMethod(node.instance, "setActiveName", [typeof activeName === "string" ? activeName : null]);
        }
        const active = newProps.active;
        if (active != null && typeof active === "number") callMethod(node.instance, "setActive", [active]);
    },
};

const TextTag: RuleSet = {
    setProps: (node, newProps, _oldProps, ctx) => {
        if (!ctx.instanceIsA(node.instance, "GtkTextTag")) return;
        if (newProps.priority != null && typeof newProps.priority === "number") {
            callMethod(node.instance, "setPriority", [newProps.priority]);
        }
        if (newProps.foreground != null) Reflect.set(node.instance, "foreground", newProps.foreground);
        if (newProps.background != null) Reflect.set(node.instance, "background", newProps.background);
        if (newProps.paragraphBackground != null) {
            Reflect.set(node.instance, "paragraphBackground", newProps.paragraphBackground);
        }
    },
};

export const BUILT_IN_RULES: RuleRegistry = {
    GtkEventController: EventController,
    GtkLayoutManager: LayoutManager,
    GtkShortcut: Shortcut,
    GtkTextBuffer: TextBuffer,
    GSimpleAction: SimpleAction,
    GSimpleActionGroup: SimpleActionGroup,
    GtkColumnViewColumn: ColumnViewColumn,
    AdwToggle: Toggle,
    AdwShortcutsSection: ShortcutsSection,
    AdwShortcutsItem: ShortcutsItem,
    AdwActionRow: ActionRow,
    AdwEntryRow: EntryRow,
    AdwExpanderRow: ExpanderRow,
    AdwHeaderBar: HeaderBar,
    AdwToolbarView: ToolbarView,
    GtkActionBar: ActionBar,
    GtkHeaderBar: HeaderBar,
    GtkWidget: Widget,
    GtkShortcutController: ShortcutController,
    GtkApplicationWindow: ApplicationWindow,
    GtkApplication: Application,
    GtkSizeGroup: SizeGroup,
    GtkScale: Scale,
    GtkLevelBar: LevelBar,
    GtkCalendar: Calendar,
    AdwAlertDialog: AlertDialog,
    GtkDropTarget: DropTarget,
    GtkAboutDialog: AboutDialog,
    GtkDragSource: DragSource,
    GtkDrawingArea: DrawingArea,
    GtkEditable: Editable,
    AdwToggleGroup: ToggleGroup,
    GtkStack: Stack,
    AdwViewStack: ViewStack,
    GtkTextTag: TextTag,
};

import type { RuleContext, RuleRegistry, RuleSet } from "@gtkx/config";
import { callMethod } from "@gtkx/utils";

const nameOf = (instance: object): string => {
    const value = callMethod(instance, "getName", []);
    return typeof value === "string" ? value : "";
};

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
};

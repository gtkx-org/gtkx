import type * as Adw from "@gtkx/gi/adw";
import * as Gio from "@gtkx/gi/gio";
import * as GObject from "@gtkx/gi/gobject";
import * as Gtk from "@gtkx/gi/gtk";
import type { RuleRegistry, RuleSet } from "./reconciler-metadata.js";

const POSITION_TYPE_BOTTOM = 3;

const callMethod = (target: object, method: string, args: unknown[]): unknown => {
    const fn = Reflect.get(target, method);
    return typeof fn === "function" ? Reflect.apply(fn, target, args) : undefined;
};

const isType = <T extends GObject.Object>(instance: GObject.Object, typeName: string): instance is T => {
    let current = instance.__gtype__;
    while (current !== 0n) {
        if (GObject.typeName(current) === typeName) return true;
        current = GObject.typeParent(current);
    }
    return false;
};

const isToggleGroup = (instance: GObject.Object): instance is Adw.ToggleGroup =>
    isType<Adw.ToggleGroup>(instance, "AdwToggleGroup");
const isToggle = (instance: GObject.Object): instance is Adw.Toggle => isType<Adw.Toggle>(instance, "AdwToggle");
const isAlertDialog = (instance: GObject.Object): instance is Adw.AlertDialog =>
    isType<Adw.AlertDialog>(instance, "AdwAlertDialog");
const isViewStack = (instance: GObject.Object): instance is Adw.ViewStack =>
    isType<Adw.ViewStack>(instance, "AdwViewStack");

const nameOf = (instance: GObject.Object): string => {
    const value = callMethod(instance, "getName", []);
    return typeof value === "string" ? value : "";
};

const changed = (oldValue: unknown, newValue: unknown): boolean => oldValue !== newValue;

const asArray = <T>(value: unknown): T[] => (Array.isArray(value) ? (value as T[]) : []);

const EventController: RuleSet = {
    appendChild: (parent, child) => {
        if (parent.instance instanceof Gtk.Widget && child.instance instanceof Gtk.EventController) {
            parent.instance.addController(child.instance);
        }
    },
    removeChild: (parent, child) => {
        if (
            parent.instance instanceof Gtk.Widget &&
            child.instance instanceof Gtk.EventController &&
            child.instance.getWidget() === parent.instance
        ) {
            parent.instance.removeController(child.instance);
        }
    },
};

const LayoutManager: RuleSet = {
    appendChild: (parent, child) => {
        if (parent.instance instanceof Gtk.Widget && child.instance instanceof Gtk.LayoutManager) {
            parent.instance.setLayoutManager(child.instance);
        }
    },
    removeChild: (parent, child) => {
        if (parent.instance instanceof Gtk.Widget && parent.instance.getLayoutManager() === child.instance) {
            parent.instance.setLayoutManager(null);
        }
    },
};

const Shortcut: RuleSet = {
    appendChild: (parent, child) => {
        if (parent.instance instanceof Gtk.ShortcutController && child.instance instanceof Gtk.Shortcut) {
            parent.instance.addShortcut(child.instance);
        }
    },
    removeChild: (parent, child) => {
        if (parent.instance instanceof Gtk.ShortcutController && child.instance instanceof Gtk.Shortcut) {
            parent.instance.removeShortcut(child.instance);
        }
    },
};

const TextBuffer: RuleSet = {
    appendChild: (parent, child) => {
        if (parent.instance instanceof Gtk.TextView && child.instance instanceof Gtk.TextBuffer) {
            parent.instance.setBuffer(child.instance);
        }
    },
    removeChild: (parent, child) => {
        if (parent.instance instanceof Gtk.TextView && parent.instance.getBuffer() === child.instance) {
            parent.instance.setBuffer(null);
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
    appendChild: (parent, child) => {
        const prefix = child.props["prefix"];
        if (
            parent.instance instanceof Gtk.Widget &&
            child.instance instanceof Gio.ActionGroup &&
            typeof prefix === "string"
        ) {
            parent.instance.insertActionGroup(prefix, child.instance);
        }
    },
    removeChild: (parent, child) => {
        const prefix = child.props["prefix"];
        if (parent.instance instanceof Gtk.Widget && typeof prefix === "string") {
            parent.instance.insertActionGroup(prefix, null);
        }
    },
};

const ColumnViewColumn: RuleSet = {
    appendChild: (parent, child) => {
        if (parent.instance instanceof Gtk.ColumnView && child.instance instanceof Gtk.ColumnViewColumn) {
            parent.instance.appendColumn(child.instance);
        }
    },
    removeChild: (parent, child) => {
        if (parent.instance instanceof Gtk.ColumnView && child.instance instanceof Gtk.ColumnViewColumn) {
            parent.instance.removeColumn(child.instance);
        }
    },
};

const Toggle: RuleSet = {
    appendChild: (parent, child) => {
        if (isToggleGroup(parent.instance) && isToggle(child.instance)) {
            parent.instance.add(child.instance);
        }
    },
    removeChild: (parent, child) => {
        if (isToggleGroup(parent.instance) && isToggle(child.instance)) {
            parent.instance.remove(child.instance);
        }
    },
};

type Slot = {
    add: (parent: GObject.Object, child: GObject.Object) => void;
    remove?: (parent: GObject.Object, child: GObject.Object) => void;
};

const reflectAdd =
    (method: string): Slot["add"] =>
    (parent, child) => {
        callMethod(parent, method, [child]);
    };

const slots = (table: Record<string, Slot>): RuleSet => ({
    appendChild: (parent, child) => {
        const slot = child.slotTag ? table[child.slotTag] : undefined;
        if (slot) slot.add(parent.instance, child.instance);
    },
    removeChild: (parent, child) => {
        const slot = child.slotTag ? table[child.slotTag] : undefined;
        slot?.remove?.(parent.instance, child.instance);
    },
});

const PREFIX_SUFFIX: Record<string, Slot> = {
    prefix: { add: reflectAdd("addPrefix") },
    suffix: { add: reflectAdd("addSuffix") },
};

const PACK: Record<string, Slot> = {
    start: { add: reflectAdd("packStart") },
    end: { add: reflectAdd("packEnd") },
};

const ActionRow = slots(PREFIX_SUFFIX);
const EntryRow = slots(PREFIX_SUFFIX);
const ExpanderRow = slots({
    ...PREFIX_SUFFIX,
    rows: { add: reflectAdd("addRow") },
    actions: { add: reflectAdd("addAction") },
});
const HeaderBar = slots(PACK);
const ToolbarView = slots({
    topBar: { add: reflectAdd("addTopBar") },
    bottomBar: { add: reflectAdd("addBottomBar") },
});
const ActionBar = slots(PACK);

const Widget: RuleSet = {
    appendChild: (parent, child) => {
        if (!(parent.instance instanceof Gtk.Widget)) return;
        if (child.slotTag === "controllers" && child.instance instanceof Gtk.EventController) {
            parent.instance.addController(child.instance);
        } else if (
            child.slotTag === "actionGroups" &&
            child.instance instanceof Gio.ActionGroup &&
            typeof child.props["prefix"] === "string"
        ) {
            parent.instance.insertActionGroup(child.props["prefix"], child.instance);
        }
    },
    removeChild: (parent, child) => {
        if (!(parent.instance instanceof Gtk.Widget)) return;
        if (
            child.slotTag === "controllers" &&
            child.instance instanceof Gtk.EventController &&
            child.instance.getWidget() === parent.instance
        ) {
            parent.instance.removeController(child.instance);
        } else if (child.slotTag === "actionGroups" && typeof child.props["prefix"] === "string") {
            parent.instance.insertActionGroup(child.props["prefix"], null);
        }
    },
};

const ShortcutController: RuleSet = {
    appendChild: (parent, child) => {
        if (
            child.slotTag === "shortcuts" &&
            parent.instance instanceof Gtk.ShortcutController &&
            child.instance instanceof Gtk.Shortcut
        ) {
            parent.instance.addShortcut(child.instance);
        }
    },
    removeChild: (parent, child) => {
        if (
            child.slotTag === "shortcuts" &&
            parent.instance instanceof Gtk.ShortcutController &&
            child.instance instanceof Gtk.Shortcut
        ) {
            parent.instance.removeShortcut(child.instance);
        }
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

interface ActionAccelItem {
    action: string;
    accels: string[];
}

const Application: RuleSet = {
    setProps: (node, newProps, oldProps) => {
        if (
            !(node.instance instanceof Gtk.Application) ||
            !changed(oldProps?.["actionAccels"], newProps["actionAccels"])
        ) {
            return;
        }
        for (const accel of asArray<ActionAccelItem>(oldProps?.["actionAccels"])) {
            node.instance.setAccelsForAction(accel.action, []);
        }
        for (const accel of asArray<ActionAccelItem>(newProps["actionAccels"])) {
            node.instance.setAccelsForAction(accel.action, accel.accels);
        }
    },
};

const SizeGroup: RuleSet = {
    setProps: (node, newProps, oldProps) => {
        if (!(node.instance instanceof Gtk.SizeGroup) || !changed(oldProps?.["widgets"], newProps["widgets"])) return;
        for (const widget of asArray<Gtk.Widget>(oldProps?.["widgets"])) node.instance.removeWidget(widget);
        for (const widget of asArray<Gtk.Widget>(newProps["widgets"])) node.instance.addWidget(widget);
    },
};

interface ScaleMarkItem {
    value: number;
    position?: number;
    label?: string | null;
}

const Scale: RuleSet = {
    setProps: (node, newProps, oldProps) => {
        if (!(node.instance instanceof Gtk.Scale) || !changed(oldProps?.["marks"], newProps["marks"])) return;
        node.instance.clearMarks();
        for (const mark of asArray<ScaleMarkItem>(newProps["marks"])) {
            node.instance.addMark(mark.value, mark.position ?? POSITION_TYPE_BOTTOM, mark.label ?? null);
        }
    },
};

interface LevelBarOffsetItem {
    id: string;
    value: number;
}

const LevelBar: RuleSet = {
    setProps: (node, newProps, oldProps) => {
        if (!(node.instance instanceof Gtk.LevelBar) || !changed(oldProps?.["offsets"], newProps["offsets"])) return;
        for (const offset of asArray<LevelBarOffsetItem>(oldProps?.["offsets"])) {
            node.instance.removeOffsetValue(offset.id);
        }
        for (const offset of asArray<LevelBarOffsetItem>(newProps["offsets"])) {
            node.instance.addOffsetValue(offset.id, offset.value);
        }
    },
};

const Calendar: RuleSet = {
    setProps: (node, newProps, oldProps) => {
        if (!(node.instance instanceof Gtk.Calendar) || !changed(oldProps?.["markedDays"], newProps["markedDays"])) {
            return;
        }
        node.instance.clearMarks();
        for (const day of asArray<number>(newProps["markedDays"])) node.instance.markDay(day);
    },
};

interface AlertResponseItem {
    id: string;
    label: string;
    appearance?: number;
    enabled?: boolean;
}

const AlertDialog: RuleSet = {
    setProps: (node, newProps, oldProps) => {
        if (!isAlertDialog(node.instance) || !changed(oldProps?.["responses"], newProps["responses"])) {
            return;
        }
        for (const response of asArray<AlertResponseItem>(oldProps?.["responses"])) {
            node.instance.removeResponse(response.id);
        }
        for (const response of asArray<AlertResponseItem>(newProps["responses"])) {
            node.instance.addResponse(response.id, response.label);
            if (response.appearance !== undefined) {
                node.instance.setResponseAppearance(response.id, response.appearance);
            }
            if (response.enabled !== undefined) node.instance.setResponseEnabled(response.id, response.enabled);
        }
    },
};

const DropTarget: RuleSet = {
    setProps: (node, newProps, oldProps) => {
        if (!(node.instance instanceof Gtk.DropTarget) || !changed(oldProps?.["types"], newProps["types"])) return;
        node.instance.setGtypes(asArray<GObject.GType>(newProps["types"]));
    },
};

interface CreditSectionItem {
    name: string;
    people: string[];
}

const AboutDialog: RuleSet = {
    setProps: (node, newProps, oldProps) => {
        if (
            !(node.instance instanceof Gtk.AboutDialog) ||
            !changed(oldProps?.["creditSections"], newProps["creditSections"])
        ) {
            return;
        }
        if (asArray<CreditSectionItem>(oldProps?.["creditSections"]).length !== 0) return;
        for (const section of asArray<CreditSectionItem>(newProps["creditSections"])) {
            node.instance.addCreditSection(section.name, section.people);
        }
    },
};

interface DragSourceIconItem {
    paintable: import("@gtkx/gi/gdk").Paintable;
    hotX?: number;
    hotY?: number;
}

const DragSource: RuleSet = {
    setProps: (node, newProps, oldProps) => {
        if (!(node.instance instanceof Gtk.DragSource) || !changed(oldProps?.["icon"], newProps["icon"])) return;
        const icon = newProps["icon"];
        if (icon == null) {
            node.instance.setIcon(null, 0, 0);
            return;
        }
        const value = icon as DragSourceIconItem;
        node.instance.setIcon(value.paintable, value.hotX ?? 0, value.hotY ?? 0);
    },
};

const DrawingArea: RuleSet = {
    setProps: (node, newProps, oldProps) => {
        if (!(node.instance instanceof Gtk.DrawingArea) || !changed(oldProps?.["drawFunc"], newProps["drawFunc"])) {
            return;
        }
        const drawFunc = newProps["drawFunc"];
        node.instance.setDrawFunc(typeof drawFunc === "function" ? (drawFunc as Gtk.DrawingAreaDrawFunc) : null);
        node.instance.queueDraw();
    },
};

const Editable: RuleSet = {
    setProps: (node, newProps, oldProps) => {
        if (!(node.instance instanceof Gtk.Editable)) return;
        const value = newProps["text"];
        if (!changed(oldProps?.["text"], value) || typeof value !== "string") return;
        const committed = oldProps?.["text"];
        if (committed !== undefined && node.instance.getText() !== committed) return;
        Reflect.set(node.instance, "text", value);
    },
};

const applyStackPage = (instance: GObject.Object, newProps: Record<string, unknown>): void => {
    const value = newProps["visibleChildName"];
    if (typeof value !== "string" || value === "") return;
    if (callMethod(instance, "getVisibleChildName", []) !== value && callMethod(instance, "getChildByName", [value])) {
        callMethod(instance, "setVisibleChildName", [value]);
    }
};

const Stack: RuleSet = {
    setProps: (node, newProps) => {
        if (node.instance instanceof Gtk.Stack) applyStackPage(node.instance, newProps);
    },
};

const ViewStack: RuleSet = {
    setProps: (node, newProps) => {
        if (isViewStack(node.instance)) applyStackPage(node.instance, newProps);
    },
};

const ToggleGroup: RuleSet = {
    setProps: (node, newProps) => {
        if (!isToggleGroup(node.instance)) return;
        const activeName = newProps["activeName"];
        if (activeName !== undefined) node.instance.setActiveName(typeof activeName === "string" ? activeName : null);
        const active = newProps["active"];
        if (active != null && typeof active === "number") node.instance.setActive(active);
    },
};

const TextTag: RuleSet = {
    setProps: (node, newProps) => {
        if (!(node.instance instanceof Gtk.TextTag)) return;
        if (newProps["priority"] != null && typeof newProps["priority"] === "number") {
            node.instance.setPriority(newProps["priority"]);
        }
        if (newProps["foreground"] != null) Reflect.set(node.instance, "foreground", newProps["foreground"]);
        if (newProps["background"] != null) Reflect.set(node.instance, "background", newProps["background"]);
        if (newProps["paragraphBackground"] != null) {
            Reflect.set(node.instance, "paragraphBackground", newProps["paragraphBackground"]);
        }
    },
};

/**
 * The hand-written rule registry keyed by GLib type name. Each entry supplies
 * the function-based attach/detach and prop-application behavior the reconciler
 * resolves by GType ancestry. Consumed at runtime by the generated
 * `virtual:gtkx-config` module via the `@gtkx/config/rules` export.
 *
 * @public
 */
export const BUILT_IN_RULES: RuleRegistry = {
    GtkEventController: EventController,
    GtkLayoutManager: LayoutManager,
    GtkShortcut: Shortcut,
    GtkTextBuffer: TextBuffer,
    GSimpleAction: SimpleAction,
    GSimpleActionGroup: SimpleActionGroup,
    GtkColumnViewColumn: ColumnViewColumn,
    AdwToggle: Toggle,
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

/**
 * Merges the built-in registry with an optional user-supplied transform. The
 * transform receives the built-ins and returns the registry the runtime
 * consumes. Consumed at runtime by the generated `virtual:gtkx-config` module
 * via the `@gtkx/config/rules` export.
 *
 * @public
 */
export const mergeRules = (builtins: RuleRegistry, user?: (builtins: RuleRegistry) => RuleRegistry): RuleRegistry =>
    user ? user(builtins) : builtins;

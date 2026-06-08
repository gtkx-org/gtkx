/**
 * Per-GType prop descriptors for the generic {@link ElementNode}.
 *
 * A handful of widget props are not plain GObject properties: applying them is
 * an imperative GTK call (`addMark`, `addResponse`, `setVisibleChildName`, …) or
 * a refined signal connection. Those props live here as data keyed by GLib type
 * name, and {@link ElementNode} merges the matching entries (walking the
 * instance's GType ancestry) into its descriptor table, sparing each widget a
 * bespoke node subclass.
 *
 * Declarative array props rebuild on reference change: when the prop's array
 * identity differs from the previous commit, the previously-applied items are
 * cleared and the current ones re-applied. Callers that re-render frequently
 * should memoize the array to avoid needless rebuilds.
 */
import * as Adw from "@gtkx/gi/adw";
import * as Gio from "@gtkx/gi/gio";
import type { GType } from "@gtkx/gi/gobject";
import * as Gtk from "@gtkx/gi/gtk";
import { buildMenuModel, type MenuActionContext, type MenuEntry } from "../../components/internal/menu-model.js";
import type {
    AlertDialogResponseProps,
    GtkSourceViewProps,
    GtkTextViewProps,
    LevelBarOffset,
    ScaleMark,
    ToggleProps,
} from "../../jsx.js";
import type { Node } from "../../node.js";
import { scheduleAfterCommit } from "../../post-commit-queue.js";
import { type ImperativeHandler, imperative, type PropDescriptorTable, signal } from "./apply-props.js";
import { getTextBufferController } from "./text-buffer-registry.js";

/** Builds the descriptor set a single GType contributes to a node. */
type DescriptorFactory = (node: Node) => PropDescriptorTable;

const applyToggleProps = (toggle: Adw.Toggle, props: ToggleProps): void => {
    if (props.id != null) toggle.setName(props.id);
    if (props.label != null) toggle.setLabel(props.label);
    if (props.iconName != null) toggle.setIconName(props.iconName);
    if (props.tooltip !== undefined) toggle.setTooltip(props.tooltip);
    if (props.enabled !== undefined) toggle.setEnabled(props.enabled);
    if (props.useUnderline !== undefined) toggle.setUseUnderline(props.useUnderline);
};

const scaleDescriptors: DescriptorFactory = (node): PropDescriptorTable => {
    const scale = node.backingInstance;
    if (!(scale instanceof Gtk.Scale)) return {};
    return {
        marks: imperative(() => {
            scale.clearMarks();
            for (const mark of (node.props.marks as readonly ScaleMark[] | null | undefined) ?? []) {
                scale.addMark(mark.value, mark.position ?? Gtk.PositionType.BOTTOM, mark.label ?? null);
            }
        }),
    };
};

const levelBarDescriptors: DescriptorFactory = (node): PropDescriptorTable => {
    const bar = node.backingInstance;
    if (!(bar instanceof Gtk.LevelBar)) return {};
    return {
        offsets: imperative((oldProps) => {
            for (const offset of (oldProps?.offsets as readonly LevelBarOffset[] | null | undefined) ?? []) {
                bar.removeOffsetValue(offset.id);
            }
            for (const offset of (node.props.offsets as readonly LevelBarOffset[] | null | undefined) ?? []) {
                bar.addOffsetValue(offset.id, offset.value);
            }
        }),
    };
};

const calendarDescriptors: DescriptorFactory = (node): PropDescriptorTable => {
    const calendar = node.backingInstance;
    if (!(calendar instanceof Gtk.Calendar)) return {};
    return {
        markedDays: imperative(() => {
            calendar.clearMarks();
            for (const day of (node.props.markedDays as readonly number[] | null | undefined) ?? []) {
                calendar.markDay(day);
            }
        }),
    };
};

const toggleGroupDescriptors: DescriptorFactory = (node): PropDescriptorTable => {
    const group = node.backingInstance;
    if (!(group instanceof Adw.ToggleGroup)) return {};
    const applySelection = (): void => {
        const activeName = node.props.activeName as string | null | undefined;
        if (activeName !== undefined) group.setActiveName(activeName);
        const active = node.props.active as number | null | undefined;
        if (active != null) group.setActive(active);
    };
    return {
        toggles: imperative(() => {
            group.removeAll();
            for (const toggle of (node.props.toggles as readonly ToggleProps[] | null | undefined) ?? []) {
                const item = new Adw.Toggle();
                applyToggleProps(item, toggle);
                group.add(item);
            }
        }),
        active: imperative(applySelection, { always: true }),
        activeName: imperative(applySelection, { always: true }),
    };
};

const stackDescriptors: DescriptorFactory = (node): PropDescriptorTable => {
    const stack = node.backingInstance;
    if (!(stack instanceof Gtk.Stack) && !(stack instanceof Adw.ViewStack)) return {};
    return {
        page: imperative(
            () => {
                const page = node.props.page as string | null | undefined;
                if (page && stack.getVisibleChildName() !== page && stack.getChildByName(page)) {
                    stack.setVisibleChildName(page);
                }
            },
            { always: true },
        ),
    };
};

const colorDialogButtonDescriptors: DescriptorFactory = (node): PropDescriptorTable => {
    const button = node.backingInstance;
    if (!(button instanceof Gtk.ColorDialogButton)) return {};
    const applyDialog = (): void => {
        const dialog = button.getDialog() ?? new Gtk.ColorDialog();
        if (button.getDialog() !== dialog) button.setDialog(dialog);
        dialog.setTitle((node.props.title as string | null | undefined) ?? "");
        dialog.setModal((node.props.modal as boolean | null | undefined) ?? true);
        dialog.setWithAlpha((node.props.withAlpha as boolean | null | undefined) ?? true);
    };
    return {
        title: imperative(applyDialog, { always: true }),
        modal: imperative(applyDialog, { always: true }),
        withAlpha: imperative(applyDialog, { always: true }),
        onRgbaChanged: signal("notify::rgba", { getArgs: () => [button.getRgba()] }),
    };
};

const fontDialogButtonDescriptors: DescriptorFactory = (node): PropDescriptorTable => {
    const button = node.backingInstance;
    if (!(button instanceof Gtk.FontDialogButton)) return {};
    const applyDialog = (): void => {
        const dialog = button.getDialog() ?? new Gtk.FontDialog();
        if (button.getDialog() !== dialog) button.setDialog(dialog);
        dialog.setTitle((node.props.title as string | null | undefined) ?? "");
        dialog.setModal((node.props.modal as boolean | null | undefined) ?? true);
        const language = node.props.language as Parameters<Gtk.FontDialog["setLanguage"]>[0] | null | undefined;
        if (language) dialog.setLanguage(language);
        dialog.setFilter((node.props.filter as Gtk.Filter | null | undefined) ?? null);
        dialog.setFontMap((node.props.fontMap as Parameters<Gtk.FontDialog["setFontMap"]>[0]) ?? null);
    };
    return {
        title: imperative(applyDialog, { always: true }),
        modal: imperative(applyDialog, { always: true }),
        language: imperative(applyDialog, { always: true }),
        filter: imperative(applyDialog, { always: true }),
        fontMap: imperative(applyDialog, { always: true }),
        onFontDescChanged: signal("notify::font-desc", {
            getArgs: () => {
                const desc = button.getFontDesc();
                return desc ? [desc] : null;
            },
        }),
    };
};

const alertDialogDescriptors: DescriptorFactory = (node): PropDescriptorTable => {
    const dialog = node.backingInstance;
    if (!(dialog instanceof Adw.AlertDialog)) return {};
    return {
        responses: imperative((oldProps) => {
            for (const response of (oldProps?.responses as readonly AlertDialogResponseProps[] | null | undefined) ??
                []) {
                dialog.removeResponse(response.id);
            }
            for (const response of (node.props.responses as readonly AlertDialogResponseProps[] | null | undefined) ??
                []) {
                dialog.addResponse(response.id, response.label);
                if (response.appearance !== undefined) dialog.setResponseAppearance(response.id, response.appearance);
                if (response.enabled !== undefined) dialog.setResponseEnabled(response.id, response.enabled);
            }
        }),
    };
};

const dropTargetDescriptors: DescriptorFactory = (node): PropDescriptorTable => {
    const target = node.backingInstance;
    if (!(target instanceof Gtk.DropTarget)) return {};
    return {
        types: imperative(() => {
            target.setGtypes((node.props.types as GType[] | null | undefined) ?? []);
        }),
    };
};

const windowDescriptors: DescriptorFactory = (node): PropDescriptorTable => {
    if (!(node.backingInstance instanceof Gtk.Window)) return {};
    return {
        onClose: signal("close-request", { getArgs: () => [], returnValue: true }),
    };
};

type TeardownRegistrar = { registerTeardown(callback: () => void): void };

const hasTeardownRegistry = (node: Node): node is Node & TeardownRegistrar =>
    typeof (node as Partial<TeardownRegistrar>).registerTeardown === "function";

const registerTeardownOn = (node: Node, callback: () => void): void => {
    if (hasTeardownRegistry(node)) node.registerTeardown(callback);
};

const findHostWidget = (node: Node): Gtk.Widget | null => {
    let current: Node | null = node.parent;
    while (current) {
        const instance = current.backingInstance;
        if (instance instanceof Gtk.Widget) return instance;
        current = current.parent;
    }
    return null;
};

const entriesHaveAccels = (entries: readonly MenuEntry[]): boolean =>
    entries.some((entry) => (entry.type === "item" ? entry.accels != null : entriesHaveAccels(entry.children)));

const resolveMenuContext = (
    node: Node,
    entries: readonly MenuEntry[],
): { context: MenuActionContext; cleanup?: () => void } | null => {
    const explicit = node.props.menuActionContext as MenuActionContext | undefined;
    if (explicit) return { context: explicit };
    const application = (node.props.menuApplication as Gtk.Application | null | undefined) ?? null;
    const host = findHostWidget(node);
    if (host && !(application && entriesHaveAccels(entries))) {
        const actionGroup = new Gio.SimpleActionGroup();
        host.insertActionGroup("menu", actionGroup);
        return {
            context: { actionMap: actionGroup, prefix: "menu", application },
            cleanup: () => host.insertActionGroup("menu", null),
        };
    }
    if (application) return { context: { actionMap: application, prefix: "app", application } };
    return null;
};

const menuDescriptors: DescriptorFactory = (node): PropDescriptorTable => {
    const menu = node.backingInstance;
    if (!(menu instanceof Gio.Menu)) return {};
    let dispose: (() => void) | null = null;

    const build = (): void => {
        dispose?.();
        dispose = null;
        menu.removeAll();
        const entries = (node.props.menuEntries as readonly MenuEntry[] | null | undefined) ?? [];
        if (entries.length === 0) return;
        const resolved = resolveMenuContext(node, entries);
        if (!resolved) return;
        const built = buildMenuModel(entries, resolved.context, menu);
        dispose = () => {
            built.dispose();
            resolved.cleanup?.();
        };
    };

    registerTeardownOn(node, () => {
        dispose?.();
        dispose = null;
    });

    return {
        menuEntries: imperative(() => scheduleAfterCommit(build)),
    };
};

const aboutDialogDescriptors: DescriptorFactory = (node): PropDescriptorTable => {
    const dialog = node.backingInstance;
    if (!(dialog instanceof Gtk.AboutDialog)) return {};
    return {
        creditSections: imperative((oldProps) => {
            const previous =
                (oldProps?.creditSections as readonly { name: string; people: string[] }[] | null | undefined) ?? [];
            if (previous.length > 0) return;
            for (const section of (node.props.creditSections as
                | readonly { name: string; people: string[] }[]
                | null
                | undefined) ?? []) {
                dialog.addCreditSection(section.name, section.people);
            }
        }),
    };
};

const TEXT_VIEW_BUFFER_PROPS: readonly (keyof GtkTextViewProps)[] = [
    "buffer",
    "enableUndo",
    "onBufferChanged",
    "onTextInserted",
    "onTextDeleted",
    "onCanUndoChanged",
    "onCanRedoChanged",
];

const SOURCE_VIEW_BUFFER_PROPS: readonly (keyof GtkSourceViewProps)[] = [
    "language",
    "styleScheme",
    "highlightSyntax",
    "highlightMatchingBrackets",
    "implicitTrailingNewline",
    "onCursorMoved",
    "onHighlightUpdated",
];

const fillTable = (props: readonly string[], handler: ImperativeHandler): PropDescriptorTable => {
    const table: PropDescriptorTable = {};
    for (const prop of props) table[prop] = imperative(handler, { always: true });
    return table;
};

const TEXT_TAG_WRITE_ONLY_PROPS = ["foreground", "background", "paragraphBackground"] as const;

const textTagDescriptors: DescriptorFactory = (node): PropDescriptorTable => {
    const tag = node.backingInstance;
    if (!(tag instanceof Gtk.TextTag)) return {};
    const table: PropDescriptorTable = {
        priority: imperative(() => {
            const priority = node.props.priority as number | null | undefined;
            if (priority != null) tag.setPriority(priority);
        }),
    };
    for (const prop of TEXT_TAG_WRITE_ONLY_PROPS) {
        table[prop] = imperative(() => {
            const value = node.props[prop] as string | null | undefined;
            if (value != null) Reflect.set(tag, prop, value);
        });
    }
    return table;
};

const textViewDescriptors: DescriptorFactory = (node): PropDescriptorTable => {
    const view = node.backingInstance;
    if (!(view instanceof Gtk.TextView)) return {};
    const controller = getTextBufferController(node, view);
    const apply: ImperativeHandler = (oldProps) => controller.applyProps(oldProps, node.props);
    return fillTable(TEXT_VIEW_BUFFER_PROPS, apply);
};

const sourceViewDescriptors: DescriptorFactory = (node): PropDescriptorTable => {
    const view = node.backingInstance;
    if (!(view instanceof Gtk.TextView)) return {};
    const controller = getTextBufferController(node, view);
    const applySource: ImperativeHandler = (oldProps) => controller.applySourceProps(oldProps, node.props);
    return fillTable(SOURCE_VIEW_BUFFER_PROPS, applySource);
};

/**
 * Maps a GLib type name to the prop descriptors that {@link ElementNode} merges
 * for any instance whose GType ancestry includes that type.
 */
export const PROP_DESCRIPTOR_TABLE: Readonly<Record<string, DescriptorFactory>> = {
    GtkScale: scaleDescriptors,
    GtkLevelBar: levelBarDescriptors,
    GtkCalendar: calendarDescriptors,
    AdwToggleGroup: toggleGroupDescriptors,
    GtkStack: stackDescriptors,
    AdwViewStack: stackDescriptors,
    GtkColorDialogButton: colorDialogButtonDescriptors,
    GtkFontDialogButton: fontDialogButtonDescriptors,
    AdwAlertDialog: alertDialogDescriptors,
    GtkDropTarget: dropTargetDescriptors,
    GtkWindow: windowDescriptors,
    GtkAboutDialog: aboutDialogDescriptors,
    GMenu: menuDescriptors,
    GtkTextTag: textTagDescriptors,
    GtkTextView: textViewDescriptors,
    GtkSourceView: sourceViewDescriptors,
};

/**
 * Props that must be withheld from a widget's constructor because their JSX form
 * is not the GObject property's value type (the descriptor sets the real value
 * after construction). Keyed by GLib type name.
 */
export const CONSTRUCTION_SKIP_PROPS: Readonly<Record<string, readonly string[]>> = {};

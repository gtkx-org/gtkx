/**
 * Per-GType signal/imperative prop descriptors for real-GObject instances.
 *
 * A handful of widget props are neither plain GObject properties nor array props:
 * applying them is an imperative GTK call (`setVisibleChildName`, dialog setup,
 * buffer rebuild) or a refined signal connection. Those props live here as data
 * keyed by GLib type name; {@link getPropDescriptors} merges the matching entries
 * (walking the instance's GType ancestry) into the table the renderer's
 * `apply-props` consumes, sparing each widget a bespoke node subclass.
 */
import * as Adw from "@gtkx/gi/adw";
import * as Gio from "@gtkx/gi/gio";
import * as Gtk from "@gtkx/gi/gtk";
import { scheduleFlush } from "../../commit-flush.js";
import { buildMenuModel, type MenuActionContext, type MenuEntry } from "../../components/internal/menu-model.js";
import { collectTypeNameChain } from "../../gtype.js";
import { type Instance, registerTeardown } from "../../instance.js";
import type { GtkSourceViewProps, GtkTextViewProps } from "../../jsx.js";
import { type ImperativeHandler, imperative, type PropDescriptorTable, signal } from "./apply-props.js";
import { getTextBufferController } from "./text-buffer-registry.js";

/** Builds the descriptor set a single GType contributes to an instance. */
type DescriptorFactory = (instance: Instance) => PropDescriptorTable;

const toggleGroupDescriptors: DescriptorFactory = (instance): PropDescriptorTable => {
    const group = instance.backingInstance;
    if (!(group instanceof Adw.ToggleGroup)) return {};
    const applySelection = (): void => {
        const activeName = instance.props.activeName as string | null | undefined;
        if (activeName !== undefined) group.setActiveName(activeName);
        const active = instance.props.active as number | null | undefined;
        if (active != null) group.setActive(active);
    };
    return {
        active: imperative(applySelection, { always: true }),
        activeName: imperative(applySelection, { always: true }),
    };
};

const stackDescriptors: DescriptorFactory = (instance): PropDescriptorTable => {
    const stack = instance.backingInstance;
    if (!(stack instanceof Gtk.Stack) && !(stack instanceof Adw.ViewStack)) return {};
    return {
        page: imperative(
            () => {
                const page = instance.props.page as string | null | undefined;
                if (page && stack.getVisibleChildName() !== page && stack.getChildByName(page)) {
                    stack.setVisibleChildName(page);
                }
            },
            { always: true },
        ),
    };
};

const colorDialogButtonDescriptors: DescriptorFactory = (instance): PropDescriptorTable => {
    const button = instance.backingInstance;
    if (!(button instanceof Gtk.ColorDialogButton)) return {};
    const applyDialog = (): void => {
        const dialog = button.getDialog() ?? new Gtk.ColorDialog();
        if (button.getDialog() !== dialog) button.setDialog(dialog);
        dialog.setTitle((instance.props.title as string | null | undefined) ?? "");
        dialog.setModal((instance.props.modal as boolean | null | undefined) ?? true);
        dialog.setWithAlpha((instance.props.withAlpha as boolean | null | undefined) ?? true);
    };
    return {
        title: imperative(applyDialog, { always: true }),
        modal: imperative(applyDialog, { always: true }),
        withAlpha: imperative(applyDialog, { always: true }),
        onRgbaChanged: signal("notify::rgba", { getArgs: () => [button.getRgba()] }),
    };
};

const fontDialogButtonDescriptors: DescriptorFactory = (instance): PropDescriptorTable => {
    const button = instance.backingInstance;
    if (!(button instanceof Gtk.FontDialogButton)) return {};
    const applyDialog = (): void => {
        const dialog = button.getDialog() ?? new Gtk.FontDialog();
        if (button.getDialog() !== dialog) button.setDialog(dialog);
        dialog.setTitle((instance.props.title as string | null | undefined) ?? "");
        dialog.setModal((instance.props.modal as boolean | null | undefined) ?? true);
        const language = instance.props.language as Parameters<Gtk.FontDialog["setLanguage"]>[0] | null | undefined;
        if (language) dialog.setLanguage(language);
        dialog.setFilter((instance.props.filter as Gtk.Filter | null | undefined) ?? null);
        dialog.setFontMap((instance.props.fontMap as Parameters<Gtk.FontDialog["setFontMap"]>[0]) ?? null);
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

const windowDescriptors: DescriptorFactory = (instance): PropDescriptorTable => {
    if (!(instance.backingInstance instanceof Gtk.Window)) return {};
    return {
        onClose: signal("close-request", { getArgs: () => [], returnValue: true }),
    };
};

const findHostWidget = (instance: Instance): Gtk.Widget | null => {
    let current: Instance | null = instance.parent;
    while (current) {
        const backing = current.backingInstance;
        if (backing instanceof Gtk.Widget) return backing;
        current = current.parent;
    }
    return null;
};

const entriesHaveAccels = (entries: readonly MenuEntry[]): boolean =>
    entries.some((entry) => (entry.type === "item" ? entry.accels != null : entriesHaveAccels(entry.children)));

const resolveMenuContext = (
    instance: Instance,
    entries: readonly MenuEntry[],
): { context: MenuActionContext; cleanup?: () => void } | null => {
    const explicit = instance.props.menuActionContext as MenuActionContext | undefined;
    if (explicit) return { context: explicit };
    const application = (instance.props.menuApplication as Gtk.Application | null | undefined) ?? null;
    const host = findHostWidget(instance);
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

const menuDescriptors: DescriptorFactory = (instance): PropDescriptorTable => {
    const menu = instance.backingInstance;
    if (!(menu instanceof Gio.Menu)) return {};
    let dispose: (() => void) | null = null;

    const build = (): void => {
        dispose?.();
        dispose = null;
        menu.removeAll();
        const entries = (instance.props.menuEntries as readonly MenuEntry[] | null | undefined) ?? [];
        if (entries.length === 0) return;
        const resolved = resolveMenuContext(instance, entries);
        if (!resolved) return;
        const built = buildMenuModel(entries, resolved.context, menu);
        dispose = () => {
            built.dispose();
            resolved.cleanup?.();
        };
    };

    registerTeardown(instance, () => {
        dispose?.();
        dispose = null;
    });

    return {
        menuEntries: imperative(() => scheduleFlush(build)),
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

const textTagDescriptors: DescriptorFactory = (instance): PropDescriptorTable => {
    const tag = instance.backingInstance;
    if (!(tag instanceof Gtk.TextTag)) return {};
    const table: PropDescriptorTable = {
        priority: imperative(() => {
            const priority = instance.props.priority as number | null | undefined;
            if (priority != null) tag.setPriority(priority);
        }),
    };
    for (const prop of TEXT_TAG_WRITE_ONLY_PROPS) {
        table[prop] = imperative(() => {
            const value = instance.props[prop] as string | null | undefined;
            if (value != null) Reflect.set(tag, prop, value);
        });
    }
    return table;
};

const textViewDescriptors: DescriptorFactory = (instance): PropDescriptorTable => {
    const view = instance.backingInstance;
    if (!(view instanceof Gtk.TextView)) return {};
    const controller = getTextBufferController(instance, view);
    const apply: ImperativeHandler = (oldProps) => controller.applyProps(oldProps, instance.props);
    return fillTable(TEXT_VIEW_BUFFER_PROPS, apply);
};

const sourceViewDescriptors: DescriptorFactory = (instance): PropDescriptorTable => {
    const view = instance.backingInstance;
    if (!(view instanceof Gtk.TextView)) return {};
    const controller = getTextBufferController(instance, view);
    const applySource: ImperativeHandler = (oldProps) => controller.applySourceProps(oldProps, instance.props);
    return fillTable(SOURCE_VIEW_BUFFER_PROPS, applySource);
};

/**
 * Maps a GLib type name to the prop descriptors merged for any instance whose
 * GType ancestry includes that type.
 */
const PROP_DESCRIPTOR_TABLE: Readonly<Record<string, DescriptorFactory>> = {
    AdwToggleGroup: toggleGroupDescriptors,
    GtkStack: stackDescriptors,
    AdwViewStack: stackDescriptors,
    GtkColorDialogButton: colorDialogButtonDescriptors,
    GtkFontDialogButton: fontDialogButtonDescriptors,
    GtkWindow: windowDescriptors,
    GMenu: menuDescriptors,
    GtkTextTag: textTagDescriptors,
    GtkTextView: textViewDescriptors,
    GtkSourceView: sourceViewDescriptors,
};

const tableCache = new WeakMap<Instance, PropDescriptorTable>();

/**
 * Returns the signal/imperative prop descriptors for `instance`, merged across
 * its backing GObject's GType ancestry (most-derived entries win). Cached per
 * instance, since each factory closes over the instance.
 *
 * @param instance - The reconciler instance whose descriptors to resolve.
 */
export const getPropDescriptors = (instance: Instance): PropDescriptorTable => {
    const cached = tableCache.get(instance);
    if (cached) return cached;
    let table: PropDescriptorTable = {};
    const backing = instance.backingInstance;
    if (backing) {
        for (const typeName of collectTypeNameChain(backing.__gtype__)) {
            const factory = PROP_DESCRIPTOR_TABLE[typeName];
            if (factory) table = { ...factory(instance), ...table };
        }
    }
    tableCache.set(instance, table);
    return table;
};

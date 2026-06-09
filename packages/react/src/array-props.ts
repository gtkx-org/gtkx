/**
 * The reconciler's array-prop table.
 *
 * A handful of widget props take an array whose elements map to repeated GTK
 * calls (`addMark`, `addResponse`, `markDay`, …) rather than a single property
 * set. {@link ARRAY_PROPS} keys those by GLib type name then prop name, each
 * value describing how one element is added, an old element removed, or the
 * whole list cleared/replaced. `apply-props` walks an instance's GType ancestry,
 * and on array-identity change reconciles the previous elements against the
 * current ones through the matching descriptor.
 *
 * {@link ARRAY_PROPS} owns the runtime add/remove/clear behavior. The matching
 * JSX surface — the typed prop line in each generated `Props` interface and the
 * suppression of the raw GObject prop of the same name — is owned by the codegen
 * `arrayProps` map, keyed by the same JSX element and prop names.
 */
import type * as Adw from "@gtkx/gi/adw";
import type { GType } from "@gtkx/gi/gobject";
import * as Gtk from "@gtkx/gi/gtk";
import { collectTypeNameChain } from "./gtype.js";
import { isAdwAlertDialog, isAdwToggleGroup, requireClassByName } from "./gtype-predicates.js";
import type {
    AlertDialogResponseProps,
    CalendarMark,
    CreditSection,
    DropTargetType,
    LevelBarOffset,
    ScaleMark,
    ToggleProps,
} from "./jsx.js";
import type { BackingInstance } from "./types.js";

/**
 * Describes how one array-valued prop reconciles its elements into GTK calls.
 * Apply order: `set` replaces the whole list in one call; otherwise old elements
 * are removed (`clear` once, else `remove` each) and new ones added (`add` each).
 * `appendOnce` marks an immutable list applied only when the previous one was
 * empty.
 */
export interface ArrayPropDescriptor {
    /** Removes every previously-applied element in one call. */
    clear?(target: BackingInstance): void;
    /** Removes one previously-applied element. */
    remove?(target: BackingInstance, item: unknown, index: number): void;
    /** Adds one current element. */
    add?(target: BackingInstance, item: unknown, index: number): void;
    /** Replaces the whole list in one call (used when GTK has no per-element API). */
    set?(target: BackingInstance, items: readonly unknown[]): void;
    /** When true, the list is immutable: apply only when the previous list was empty. */
    appendOnce?: boolean;
}

const applyToggleProps = (toggle: Adw.Toggle, props: ToggleProps): void => {
    if (props.id != null) toggle.setName(props.id);
    if (props.label != null) toggle.setLabel(props.label);
    if (props.iconName != null) toggle.setIconName(props.iconName);
    if (props.tooltip !== undefined) toggle.setTooltip(props.tooltip);
    if (props.enabled !== undefined) toggle.setEnabled(props.enabled);
    if (props.useUnderline !== undefined) toggle.setUseUnderline(props.useUnderline);
};

/**
 * Array props keyed by GLib type name, then by prop name. `apply-props` merges
 * the entries for every type in an instance's GType ancestry.
 */
export const ARRAY_PROPS: Readonly<Record<string, Readonly<Record<string, ArrayPropDescriptor>>>> = {
    GtkScale: {
        marks: {
            clear: (target) => {
                if (target instanceof Gtk.Scale) target.clearMarks();
            },
            add: (target, item) => {
                if (!(target instanceof Gtk.Scale)) return;
                const mark = item as ScaleMark;
                target.addMark(mark.value, mark.position ?? Gtk.PositionType.BOTTOM, mark.label ?? null);
            },
        },
    },
    GtkLevelBar: {
        offsets: {
            remove: (target, item) => {
                if (target instanceof Gtk.LevelBar) target.removeOffsetValue((item as LevelBarOffset).id);
            },
            add: (target, item) => {
                if (!(target instanceof Gtk.LevelBar)) return;
                const offset = item as LevelBarOffset;
                target.addOffsetValue(offset.id, offset.value);
            },
        },
    },
    GtkCalendar: {
        markedDays: {
            clear: (target) => {
                if (target instanceof Gtk.Calendar) target.clearMarks();
            },
            add: (target, item) => {
                if (target instanceof Gtk.Calendar) target.markDay(item as CalendarMark);
            },
        },
    },
    AdwToggleGroup: {
        toggles: {
            clear: (target) => {
                if (isAdwToggleGroup(target)) target.removeAll();
            },
            add: (target, item) => {
                if (!isAdwToggleGroup(target)) return;
                const toggle = new (requireClassByName("AdwToggle") as typeof Adw.Toggle)();
                applyToggleProps(toggle, item as ToggleProps);
                target.add(toggle);
            },
        },
    },
    AdwAlertDialog: {
        responses: {
            remove: (target, item) => {
                if (isAdwAlertDialog(target)) target.removeResponse((item as AlertDialogResponseProps).id);
            },
            add: (target, item) => {
                if (!isAdwAlertDialog(target)) return;
                const response = item as AlertDialogResponseProps;
                target.addResponse(response.id, response.label);
                if (response.appearance !== undefined) target.setResponseAppearance(response.id, response.appearance);
                if (response.enabled !== undefined) target.setResponseEnabled(response.id, response.enabled);
            },
        },
    },
    GtkDropTarget: {
        types: {
            set: (target, items) => {
                if (target instanceof Gtk.DropTarget) target.setGtypes(items as DropTargetType[]);
            },
        },
    },
    GtkAboutDialog: {
        creditSections: {
            appendOnce: true,
            add: (target, item) => {
                if (!(target instanceof Gtk.AboutDialog)) return;
                const section = item as CreditSection;
                target.addCreditSection(section.name, section.people);
            },
        },
    },
};

const arrayPropCache = new Map<GType, ReadonlyMap<string, ArrayPropDescriptor>>();

/**
 * Returns the array-prop descriptors for `instance`, merged across its GType
 * ancestry (most-derived first), keyed by prop name. Cached per GType.
 *
 * @param instance - The backing GObject whose array props to resolve.
 */
export const collectArrayProps = (instance: BackingInstance): ReadonlyMap<string, ArrayPropDescriptor> => {
    const cached = arrayPropCache.get(instance.__gtype__);
    if (cached) return cached;
    const merged = new Map<string, ArrayPropDescriptor>();
    for (const typeName of collectTypeNameChain(instance.__gtype__)) {
        const entry = ARRAY_PROPS[typeName];
        if (!entry) continue;
        for (const [prop, descriptor] of Object.entries(entry)) {
            if (!merged.has(prop)) merged.set(prop, descriptor);
        }
    }
    arrayPropCache.set(instance.__gtype__, merged);
    return merged;
};

const toArray = (value: unknown): readonly unknown[] => (Array.isArray(value) ? value : []);

/**
 * Reconciles a single array prop on `target` from its previous value to the new
 * one through `descriptor`.
 *
 * @param target - The backing GObject the prop applies to.
 * @param descriptor - The array-prop descriptor.
 * @param oldValue - The previously-committed array value.
 * @param newValue - The array value to apply.
 */
export const applyArrayProp = (
    target: BackingInstance,
    descriptor: ArrayPropDescriptor,
    oldValue: unknown,
    newValue: unknown,
): void => {
    const oldItems = toArray(oldValue);
    const newItems = toArray(newValue);
    if (descriptor.set) {
        descriptor.set(target, newItems);
        return;
    }
    if (descriptor.appendOnce) {
        if (oldItems.length === 0) addAll(target, descriptor, newItems);
        return;
    }
    if (descriptor.clear) descriptor.clear(target);
    else removeAll(target, descriptor, oldItems);
    addAll(target, descriptor, newItems);
};

const addAll = (target: BackingInstance, descriptor: ArrayPropDescriptor, items: readonly unknown[]): void => {
    items.forEach((item, index) => {
        descriptor.add?.(target, item, index);
    });
};

const removeAll = (target: BackingInstance, descriptor: ArrayPropDescriptor, items: readonly unknown[]): void => {
    items.forEach((item, index) => {
        descriptor.remove?.(target, item, index);
    });
};

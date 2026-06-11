/**
 * Incremental attach verbs for native `Gio.Menu` elements.
 *
 * A `Gio.Menu` is a snapshot model: `insertItem` copies a `Gio.MenuItem`'s
 * attributes rather than holding it live, and the menu exposes no way to find an
 * item's index. So a changed leaf item is replaced in place — `remove(position)`
 * then `insertItem(position)` — and a moved item likewise, with the position
 * read by identity from a small per-menu array of the items currently in the
 * menu ({@link menuOrder}) rather than from the opaque menu itself. Submenu and
 * section links reference live `Gio.MenuModel`s, so a nested `<GMenu>` updates on
 * its own without re-snapshotting the item that links it.
 *
 * Re-snapshots are deferred to the end-of-commit flush
 * ({@link scheduleMenuItemResnapshot}): GTK menu trackers react to
 * `items-changed` synchronously, so replacing an item mid-commit would expose
 * intermediate states — most notably an unmounting item briefly re-inserted
 * without its submenu link, which a `GtkPopoverMenuBar` cannot represent. By
 * flush time a removed item has already left its menu (the re-snapshot no-ops)
 * and a surviving item's props and links are final.
 */
import * as Gio from "@gtkx/gi/gio";
import { scheduleFlush } from "../../commit-flush.js";
import type { ElementMapping } from "../../element-map.js";
import type { Instance } from "../../instance.js";
import type { BackingInstance } from "../../types.js";

const asMenu = (instance: Instance | null | undefined): Gio.Menu | null =>
    instance?.backingInstance instanceof Gio.Menu ? instance.backingInstance : null;

const asMenuItem = (instance: Instance): Gio.MenuItem | null =>
    instance.backingInstance instanceof Gio.MenuItem ? instance.backingInstance : null;

/** The item instances currently inserted into `menu`'s `Gio.Menu`, in order. */
const menuOrder = (menu: Instance): Instance[] => {
    const existing = menu.attachState as Instance[] | undefined;
    if (existing) return existing;
    const order: Instance[] = [];
    menu.attachState = order;
    return order;
};

/**
 * Applies a `<GMenuItem>`'s declarative props to its backing `Gio.MenuItem`: its
 * label, its detailed action name, and — from a single `<GMenu>` child — its
 * submenu or section link. Run immediately before the item is snapshotted into
 * its parent menu, so the copied attributes are current.
 */
const configureMenuItem = (instance: Instance): void => {
    const item = asMenuItem(instance);
    if (!item) return;
    const { label, action, section } = instance.props;
    item.setLabel(typeof label === "string" ? label : null);
    if (typeof action === "string") item.setDetailedAction(action);
    else item.setActionAndTargetValue(null, null);
    const childMenu = instance.children.reduce<Gio.Menu | null>((found, child) => found ?? asMenu(child), null);
    if (childMenu && section === true) {
        item.setSubmenu(null);
        item.setSection(childMenu);
    } else if (childMenu) {
        item.setSection(null);
        item.setSubmenu(childMenu);
    } else {
        item.setSection(null);
        item.setSubmenu(null);
    }
};

/** The index `anchor` occupies in `order`, or the end when it is absent. */
const anchorIndex = (order: readonly Instance[], anchor: BackingInstance | null | undefined): number => {
    if (anchor instanceof Gio.MenuItem) {
        const index = order.findIndex((entry) => entry.backingInstance === anchor);
        if (index !== -1) return index;
    }
    return order.length;
};

/**
 * Replaces `item`'s stale copy in its containing menu after a leaf attribute or
 * submenu/section link changes: `remove` then `insertItem` at the same index.
 * A no-op when the item is not currently in a menu.
 *
 * @param item - The `<GMenuItem>` instance whose menu copy is stale.
 */
const resnapshotMenuItem = (item: Instance): void => {
    const parent = item.parent;
    const menu = asMenu(parent);
    const backing = asMenuItem(item);
    if (!parent || !menu || !backing) return;
    const order = menuOrder(parent);
    const index = order.indexOf(item);
    if (index === -1) return;
    menu.remove(index);
    configureMenuItem(item);
    menu.insertItem(index, backing);
};

const resnapshotCallbacks = new WeakMap<Instance, () => void>();

/** Whether `item` is currently inserted into a containing `Gio.Menu`. */
const isInMenu = (item: Instance): boolean => {
    const parent = item.parent;
    return parent !== null && asMenu(parent) !== null && menuOrder(parent).includes(item);
};

/**
 * Schedules `item`'s menu copy to be replaced at the end of the current
 * commit, once its props, children links, and menu membership are final.
 * Repeated calls for the same item within one commit collapse to a single
 * re-snapshot. An item not yet in a menu needs none: its own upcoming attach
 * snapshots the final state.
 *
 * @param item - The `<GMenuItem>` instance whose menu copy is stale.
 */
export const scheduleMenuItemResnapshot = (item: Instance): void => {
    if (!isInMenu(item)) return;
    let callback = resnapshotCallbacks.get(item);
    if (!callback) {
        callback = () => resnapshotMenuItem(item);
        resnapshotCallbacks.set(item, callback);
    }
    scheduleFlush(callback);
};

/** `<GMenuItem>` into `<GMenu>`: ordered insert with snapshot-on-change semantics. */
export const menuItemMapping: ElementMapping = {
    matches: (child, parent) => asMenuItem(child) !== null && asMenu(parent) !== null,
    attach: (child, parent, anchor) => {
        const menu = asMenu(parent);
        const item = asMenuItem(child);
        if (!menu || !item) return;
        const order = menuOrder(parent);
        const existing = order.indexOf(child);
        if (existing !== -1) {
            menu.remove(existing);
            order.splice(existing, 1);
        }
        configureMenuItem(child);
        const index = anchorIndex(order, anchor);
        menu.insertItem(index, item);
        order.splice(index, 0, child);
    },
    detach: (child, parent) => {
        const menu = asMenu(parent);
        if (!menu) return;
        const order = menuOrder(parent);
        const index = order.indexOf(child);
        if (index === -1) return;
        menu.remove(index);
        order.splice(index, 1);
    },
};

/** `<GMenu>` into `<GMenuItem>`: links a submenu or section, re-snapshotting the item. */
export const menuLinkMapping: ElementMapping = {
    matches: (child, parent) => asMenu(child) !== null && asMenuItem(parent) !== null,
    attach: (_child, parent) => scheduleMenuItemResnapshot(parent),
    detach: (_child, parent) => scheduleMenuItemResnapshot(parent),
};

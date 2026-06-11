/**
 * The menu-content builder behind the `GMenu` runtime component.
 *
 * `Gio.Menu` is a value-snapshot model: inserting an item copies its
 * attributes instead of holding it live, so the menu's content is declared as
 * plain {@link "../../element-props".MenuEntry} data and rebuilt wholesale
 * whenever the `items` prop changes. Every inserted item is fully configured
 * before it enters the model, so GTK menu trackers — which react to
 * `items-changed` synchronously — never observe a partially-built entry.
 */
import * as Gio from "@gtkx/gi/gio";
import type { MenuEntry } from "../../element-props.js";

const buildMenuModel = (entries: readonly MenuEntry[]): Gio.Menu => {
    const menu = new Gio.Menu();
    appendEntries(menu, entries);
    return menu;
};

const appendEntries = (menu: Gio.Menu, entries: readonly MenuEntry[]): void => {
    for (const entry of entries) {
        if (entry.section !== undefined) {
            menu.appendSection(entry.label ?? null, buildMenuModel(entry.section));
            continue;
        }
        if (entry.submenu !== undefined) {
            menu.appendSubmenu(entry.label ?? null, buildMenuModel(entry.submenu));
            continue;
        }
        const item = new Gio.MenuItem();
        if (entry.label !== undefined) item.setLabel(entry.label);
        if (entry.action !== undefined) item.setDetailedAction(entry.action);
        menu.appendItem(item);
    }
};

/**
 * Rebuilds `menu`'s content from `entries`: the previous content is removed
 * and every entry is appended fully configured, with sections and submenus
 * built recursively as fresh `Gio.Menu` models. `null` empties the menu.
 *
 * @param menu - The backing `Gio.Menu` whose content to rebuild.
 * @param entries - The menu's entries in order, or `null` to empty it.
 */
export const applyMenuItems = (menu: Gio.Menu, entries: readonly MenuEntry[] | null): void => {
    menu.removeAll();
    if (entries) appendEntries(menu, entries);
};

const entryEqual = (a: MenuEntry, b: MenuEntry): boolean =>
    a.label === b.label &&
    a.action === b.action &&
    entryListEqual(a.submenu, b.submenu) &&
    entryListEqual(a.section, b.section);

const entryListEqual = (a: readonly MenuEntry[] | undefined, b: readonly MenuEntry[] | undefined): boolean => {
    if (a === b) return true;
    if (a === undefined || b === undefined) return false;
    return a.length === b.length && a.every((entry, index) => entryEqual(entry, b[index] as MenuEntry));
};

/**
 * Whether two `items` values describe the same menu content, compared deeply
 * over the plain-data entry trees so a content-stable inline array does not
 * trigger a redundant rebuild.
 *
 * @param a - The previously applied entries, or `null`.
 * @param b - The current entries, or `null`.
 */
export const menuItemsEqual = (a: readonly MenuEntry[] | null, b: readonly MenuEntry[] | null): boolean => {
    if (a === b) return true;
    if (a === null || b === null) return false;
    return entryListEqual(a, b);
};

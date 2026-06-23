import * as Gio from "@gtkx/gi/gio";
import type { MenuEntry } from "./types.js";

const buildMenuModel = (entries: MenuEntry[]): Gio.Menu => {
    const menu = new Gio.Menu();
    appendEntries(menu, entries);
    return menu;
};

const appendEntries = (menu: Gio.Menu, entries: MenuEntry[]): void => {
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

export const applyMenuItems = (menu: Gio.Menu, entries: MenuEntry[] | null): void => {
    menu.removeAll();
    if (entries) appendEntries(menu, entries);
};

const entryEqual = (a: MenuEntry, b: MenuEntry): boolean =>
    a.label === b.label &&
    a.action === b.action &&
    entryListEqual(a.submenu, b.submenu) &&
    entryListEqual(a.section, b.section);

const entryListEqual = (a: MenuEntry[] | undefined, b: MenuEntry[] | undefined): boolean => {
    if (a === b) return true;
    if (a === undefined || b === undefined) return false;
    return a.length === b.length && a.every((entry, index) => entryEqual(entry, b[index] as MenuEntry));
};

export const menuItemsEqual = (a: MenuEntry[] | null, b: MenuEntry[] | null): boolean => {
    if (a === b) return true;
    if (a === null || b === null) return false;
    return entryListEqual(a, b);
};

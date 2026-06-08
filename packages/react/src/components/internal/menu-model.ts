import * as Gio from "@gtkx/gi/gio";
import type * as Gtk from "@gtkx/gi/gtk";

/** A declarative description of one entry in a `Gio.Menu` model. */
export type MenuEntry =
    | {
          /** Discriminator for an activatable leaf item. */
          readonly type: "item";
          /** Unique action id within the menu's action map. */
          readonly id: string;
          /** Display label, with an underscore marking the mnemonic. */
          readonly label: string;
          /** Callback invoked when the item is activated. */
          readonly onActivate: () => void;
          /** Keyboard accelerator(s) bound to the item's action. */
          readonly accels?: string | string[];
      }
    | {
          /** Discriminator for a grouping section. */
          readonly type: "section";
          /** Optional section header label. */
          readonly label?: string;
          /** The section's nested entries. */
          readonly children: readonly MenuEntry[];
      }
    | {
          /** Discriminator for a nested submenu. */
          readonly type: "submenu";
          /** The submenu's display label. */
          readonly label: string;
          /** The submenu's nested entries. */
          readonly children: readonly MenuEntry[];
      };

/**
 * The action context a menu model registers its activatable items against. The
 * menu item's `action` attribute references `"${prefix}.${id}"`; the matching
 * `Gio.SimpleAction` is added to {@link actionMap}, and accelerators are bound on
 * {@link application} when present.
 */
export interface MenuActionContext {
    /** The action map the menu's `Gio.SimpleAction`s register on. */
    readonly actionMap: Gio.ActionMap;
    /** The action-name prefix referenced by menu item `action` attributes. */
    readonly prefix: string;
    /** The application used to bind accelerators, or `null` when unavailable. */
    readonly application: Gtk.Application | null;
}

/** A built `Gio.Menu` model paired with the teardown that releases its actions. */
export interface BuiltMenuModel {
    /** The populated `Gio.Menu` to install on a host widget or application. */
    readonly menu: Gio.Menu;
    /**
     * Removes every registered action from the action map, clears bound
     * accelerators, and empties the menu. Idempotent and deterministic, so
     * repeated build/dispose cycles keep the action map and menu population flat.
     */
    readonly dispose: () => void;
}

const toAccels = (accels: string | string[] | undefined): string[] => {
    if (!accels) return [];
    return Array.isArray(accels) ? accels : [accels];
};

const registerItem = (
    menu: Gio.Menu,
    entry: Extract<MenuEntry, { type: "item" }>,
    context: MenuActionContext,
): void => {
    const actionName = `${context.prefix}.${entry.id}`;
    const action = Gio.SimpleAction.new(entry.id, null);
    action.connect("activate", () => entry.onActivate());
    context.actionMap.addAction(action);
    if (context.application && entry.accels) {
        context.application.setAccelsForAction(actionName, toAccels(entry.accels));
    }
    menu.append(entry.label, actionName);
};

const populate = (
    menu: Gio.Menu,
    entries: readonly MenuEntry[],
    context: MenuActionContext,
    registeredIds: string[],
): void => {
    for (const entry of entries) {
        if (entry.type === "item") {
            registerItem(menu, entry, context);
            registeredIds.push(entry.id);
        } else {
            const child = Gio.Menu.new();
            populate(child, entry.children, context, registeredIds);
            if (entry.type === "section") {
                menu.appendSection(entry.label ?? null, child);
            } else {
                menu.appendSubmenu(entry.label, child);
            }
        }
    }
};

const collectAccelActionNames = (entries: readonly MenuEntry[], prefix: string, names: string[]): void => {
    for (const entry of entries) {
        if (entry.type === "item") {
            if (entry.accels) names.push(`${prefix}.${entry.id}`);
        } else {
            collectAccelActionNames(entry.children, prefix, names);
        }
    }
};

/**
 * Builds a `Gio.Menu` from a declarative {@link MenuEntry} tree, registering a
 * `Gio.SimpleAction` for every activatable item on the supplied action map and
 * binding accelerators on the application when present.
 *
 * @param entries - The declarative menu structure to build.
 * @param context - The action map, prefix, and application the items register on.
 * @param target - An existing `Gio.Menu` to populate; a fresh one is created when
 *   omitted.
 * @returns The populated menu and a deterministic teardown that removes every
 *   registered action, clears accelerators, and empties the menu.
 */
export const buildMenuModel = (
    entries: readonly MenuEntry[],
    context: MenuActionContext,
    target?: Gio.Menu,
): BuiltMenuModel => {
    const menu = target ?? Gio.Menu.new();
    const registeredIds: string[] = [];
    populate(menu, entries, context, registeredIds);

    const dispose = (): void => {
        if (context.application) {
            const accelNames: string[] = [];
            collectAccelActionNames(entries, context.prefix, accelNames);
            for (const name of accelNames) context.application.setAccelsForAction(name, []);
        }
        for (const id of registeredIds) context.actionMap.removeAction(id);
        registeredIds.length = 0;
        menu.removeAll();
    };

    return { menu, dispose };
};

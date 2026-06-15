/**
 * Shared id→target registry for the `Gtk.ConstraintLayout` family.
 *
 * `<GtkConstraintLayout.Widget id>` and `<GtkConstraintLayout.Guide id>`
 * register the `Gtk.ConstraintTarget` they own under a string id; sibling
 * `<GtkConstraintLayout.Constraint>` and `<GtkConstraintLayout.Vfl>` markers
 * resolve those ids to the live target GObjects when they apply themselves. The
 * map is keyed by the owning `Gtk.ConstraintLayout` instance so several layouts
 * on a page never collide, and it is a `WeakMap` so a discarded layout drops its
 * entries automatically.
 */
import type * as Gtk from "@gtkx/gi/gtk";

const SUPER_ID = "super";

const registry = new WeakMap<Gtk.ConstraintLayout, Map<string, Gtk.ConstraintTarget>>();

const mapFor = (layout: Gtk.ConstraintLayout): Map<string, Gtk.ConstraintTarget> => {
    let map = registry.get(layout);
    if (!map) {
        map = new Map<string, Gtk.ConstraintTarget>();
        registry.set(layout, map);
    }
    return map;
};

/**
 * Registers `target` under `id` on `layout` so `<Constraint>` and `<Vfl>`
 * markers can resolve it by name.
 *
 * @param layout - The owning `Gtk.ConstraintLayout`.
 * @param id - The string id the target is referenced by.
 * @param target - The widget or guide registered as a constraint target.
 */
export const registerConstraintTarget = (
    layout: Gtk.ConstraintLayout,
    id: string,
    target: Gtk.ConstraintTarget,
): void => {
    mapFor(layout).set(id, target);
};

/**
 * Removes `id` from `layout`'s target map; called when a `<Widget>` or
 * `<Guide>` marker leaves the React tree or changes its id.
 *
 * @param layout - The owning `Gtk.ConstraintLayout`.
 * @param id - The string id to drop.
 */
export const unregisterConstraintTarget = (layout: Gtk.ConstraintLayout, id: string): void => {
    registry.get(layout)?.delete(id);
};

/**
 * Resolves `id` to its registered `Gtk.ConstraintTarget`.
 *
 * @param layout - The owning `Gtk.ConstraintLayout`.
 * @param id - The string id, `"super"`, or `undefined`.
 * @returns The target GObject, `null` for `"super"` / an omitted id (the
 *   layout-owning widget), or `undefined` when the id was never registered.
 */
export const resolveConstraintTarget = (
    layout: Gtk.ConstraintLayout,
    id: string | undefined,
): Gtk.ConstraintTarget | null | undefined => {
    if (id === undefined || id === SUPER_ID) return null;
    return registry.get(layout)?.get(id);
};

/**
 * Returns a fresh copy of `layout`'s id→target map for the VFL marker to build
 * its `views` argument, without exposing the live registry.
 *
 * @param layout - The owning `Gtk.ConstraintLayout`.
 * @returns A snapshot of the current id→target map.
 */
export const snapshotConstraintTargets = (layout: Gtk.ConstraintLayout): Map<string, Gtk.ConstraintTarget> =>
    new Map(registry.get(layout) ?? []);

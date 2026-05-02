import * as Gio from "@gtkx/ffi/gio";
import type { ApplicationFlagName } from "./config.js";

/**
 * Resolves an array of `GApplicationFlags` variant names from
 * {@link GtkxConfig.appFlags} into a single bitmask suitable for
 * passing to the GTK application runtime.
 *
 * @param names - Variant names declared in `gtkx.config.ts`, e.g.
 *     `["NON_UNIQUE", "IS_LAUNCHER"]`. May be `undefined` or empty.
 * @returns The OR-combined `Gio.ApplicationFlags` bitmask, or `undefined`
 *     when no flags were declared (caller should fall through to the
 *     runtime default).
 */
export const resolveApplicationFlags = (names: ApplicationFlagName[] | undefined): number | undefined => {
    if (names === undefined || names.length === 0) {
        return undefined;
    }
    return names.reduce<number>((acc, name) => acc | Gio.ApplicationFlags[name], 0);
};

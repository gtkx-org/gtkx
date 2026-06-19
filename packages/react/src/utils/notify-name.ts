import { toCamelCase, toKebabCase } from "@gtkx/utils";

/** The GObject `notify` signal name. */
export const NOTIFY_SIGNAL = "notify";

/** The `notify::<prop>` detailed-signal prefix. */
export const NOTIFY_DETAIL_PREFIX = "notify::";

/**
 * Maps a camelCase property name to the `notify::<prop>` detailed signal that
 * fires when it changes, kebab-casing the property to GObject's convention.
 *
 * @param property - The camelCase property name (e.g. `activeWindow`).
 * @returns The detailed signal name (e.g. `notify::active-window`).
 */
export const propToNotifySignal = (property: string): `notify::${string}` =>
    `${NOTIFY_DETAIL_PREFIX}${toKebabCase(property)}`;

/**
 * Maps a `notify::<prop>` detailed signal name back to its camelCase property,
 * the inverse of {@link propToNotifySignal}.
 *
 * @param detail - The detailed signal name (e.g. `notify::active-window`).
 * @returns The camelCase property name (e.g. `activeWindow`).
 */
export const notifyDetailToProp = (detail: string): string => toCamelCase(detail.slice(NOTIFY_DETAIL_PREFIX.length));

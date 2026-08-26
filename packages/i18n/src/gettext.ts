import { i18n } from "./i18n.js";
import { gettextLookup, ngettextLookup, npgettextLookup, pgettextLookup } from "./lookup.js";

type Values = Readonly<Record<string, unknown>>;

/** Shorthand for {@link gettext}. */
const _: typeof gettext = gettext;

const interpolate = (message: string, values: Values): string =>
    i18n.services.interpolator.interpolate(message, values, i18n.language, {});

/**
 * Translates a message in the application's gettext domain and interpolates `{{name}}` placeholders.
 * @param msgid The source message stored in the catalog.
 * @param values Values to interpolate into the translated message.
 * @returns The translated and interpolated message, or the source message when no translation exists.
 */
function gettext(msgid: string, values: Readonly<Record<string, unknown>> = {}): string {
    return interpolate(gettextLookup(msgid), values);
}

/**
 * Translates a singular/plural message pair according to the process locale.
 * @param msgid The singular source message stored in the catalog.
 * @param msgidPlural The plural source message stored in the catalog.
 * @param count The quantity used by the catalog's plural rule and exposed to interpolation as `count`.
 * @param values Additional values to interpolate into the translated message.
 * @returns The translated and interpolated plural form.
 */
function ngettext(
    msgid: string,
    msgidPlural: string,
    count: number | bigint,
    values: Readonly<Record<string, unknown>> = {},
): string {
    return interpolate(ngettextLookup(msgid, msgidPlural, count), { ...values, count });
}

/**
 * Translates a message disambiguated by gettext context.
 * @param context The catalog context separating this message from identical source text.
 * @param msgid The source message stored in the catalog.
 * @param values Values to interpolate into the translated message.
 * @returns The translated and interpolated message, or the source message when no translation exists.
 */
function pgettext(context: string, msgid: string, values: Readonly<Record<string, unknown>> = {}): string {
    return interpolate(pgettextLookup(context, msgid), values);
}

/**
 * Translates a singular/plural message pair disambiguated by gettext context.
 * @param context The catalog context separating this message from identical source text.
 * @param msgid The singular source message stored in the catalog.
 * @param msgidPlural The plural source message stored in the catalog.
 * @param count The quantity used by the catalog's plural rule and exposed to interpolation as `count`.
 * @param values Additional values to interpolate into the translated message.
 * @returns The translated and interpolated contextual plural form.
 */
function npgettext(
    ...[context, msgid, msgidPlural, count, values = {}]: [
        context: string,
        msgid: string,
        msgidPlural: string,
        count: number | bigint,
        values?: Readonly<Record<string, unknown>>,
    ]
): string {
    return interpolate(npgettextLookup(context, msgid, msgidPlural, count), { ...values, count });
}

export { _, gettext, ngettext, npgettext, pgettext };

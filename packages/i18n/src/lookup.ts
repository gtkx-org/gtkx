import * as GLib from "@gtkx/gi/glib";
import { applicationId } from "virtual:gtkx-config";

const CONTEXT_SEPARATOR = "\u{4}";

const gettextLookup = (msgid: string): string => GLib.dgettext(applicationId, msgid);

const ngettextLookup = (msgid: string, msgidPlural: string, count: number | bigint): string =>
    GLib.dngettext(applicationId, msgid, msgidPlural, BigInt(count));

const pgettextLookup = (context: string, msgid: string): string =>
    GLib.dpgettext2(applicationId, context, msgid);

const contextualMsgid = (context: string, msgid: string): string => `${context}${CONTEXT_SEPARATOR}${msgid}`;

const npgettextLookup = (context: string, msgid: string, msgidPlural: string, count: number | bigint): string => {
    const contextualSingular = contextualMsgid(context, msgid);
    const contextualPlural = contextualMsgid(context, msgidPlural);
    const translated = ngettextLookup(contextualSingular, contextualPlural, count);

    if (translated === contextualSingular) {
        return msgid;
    }

    return translated === contextualPlural ? msgidPlural : translated;
};

export { gettextLookup, ngettextLookup, npgettextLookup, pgettextLookup };

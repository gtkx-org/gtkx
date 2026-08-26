import type { BackendModule } from "i18next";
import * as GLib from "@gtkx/gi/glib";
import { applicationId } from "virtual:gtkx-config";

type GettextCatalog = {
    gettext(msgid: string): string;
    ngettext(msgid: string, msgidPlural: string, count: number | bigint): string;
    npgettext(context: string, msgid: string, msgidPlural: string, count: number | bigint): string;
    pgettext(context: string, msgid: string): string;
};

const CONTEXT_SEPARATOR = "\u{4}";
const GETTEXT_RESOURCE_KEY = "__gtkx_gettext_catalog__";

const gettextCatalog: GettextCatalog = {
    gettext(msgid) {
        return GLib.dgettext(applicationId, msgid);
    },
    ngettext(msgid, msgidPlural, count) {
        return GLib.dngettext(applicationId, msgid, msgidPlural, normalizeCount(count));
    },
    pgettext(context, msgid) {
        return GLib.dpgettext2(applicationId, context, msgid);
    },
    npgettext(context, msgid, msgidPlural, count) {
        const contextualSingular = contextualMsgid(context, msgid);
        const contextualPlural = contextualMsgid(context, msgidPlural);

        const translated = GLib.dngettext(
            applicationId,
            contextualSingular,
            contextualPlural,
            normalizeCount(count),
        );

        if (translated === contextualSingular) {
            return msgid;
        }

        return translated === contextualPlural ? msgidPlural : translated;
    },
};

const gettextBackend: BackendModule = {
    type: "backend",
    init() {
        return;
    },
    read(_language, _namespace, callback) {
        callback(null, { [GETTEXT_RESOURCE_KEY]: gettextCatalog });
    },
};

const normalizeCount = (count: number | bigint): bigint => {
    if (typeof count === "number") {
        if (!Number.isSafeInteger(count) || count < 0) {
            throw new RangeError("gettext counts must be non-negative safe integers");
        }

        return BigInt(count);
    }

    if (count < 0n) {
        throw new RangeError("gettext counts must be non-negative");
    }

    return count;
};

const contextualMsgid = (context: string, msgid: string): string => `${context}${CONTEXT_SEPARATOR}${msgid}`;
const isGettextCatalog = (value: unknown): value is GettextCatalog => value === gettextCatalog;

export { GETTEXT_RESOURCE_KEY, gettextBackend, isGettextCatalog, type GettextCatalog };

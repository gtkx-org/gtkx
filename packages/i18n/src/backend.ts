import type { BackendModule } from "i18next";
import * as GLib from "@gtkx/gi/glib";
import { applicationId } from "virtual:gtkx-config";

type GettextCatalog = {
    gettext(msgid: string): string;
    ngettext(msgid: string, msgidPlural: string, count: number): string;
    npgettext(context: string, msgid: string, msgidPlural: string, count: number): string | undefined;
    pgettext(context: string, msgid: string): string | undefined;
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
        const contextual = contextualMsgid(context, msgid);
        const translated = GLib.dgettext(applicationId, contextual);

        return translated === contextual ? undefined : translated;
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

        return translated === contextualSingular || translated === contextualPlural ? undefined : translated;
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

const normalizeCount = (count: number): bigint => {
    if (!Number.isSafeInteger(count) || count < 0) {
        throw new RangeError("gettext counts must be non-negative safe integers");
    }

    return BigInt(count);
};

const contextualMsgid = (context: string, msgid: string): string => `${context}${CONTEXT_SEPARATOR}${msgid}`;
const isGettextCatalog = (value: unknown): value is GettextCatalog => value === gettextCatalog;

export { GETTEXT_RESOURCE_KEY, gettextBackend, isGettextCatalog, type GettextCatalog };

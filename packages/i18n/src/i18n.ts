import type { i18n as I18n, I18nFormatModule, TOptions } from "i18next";
import { createInstance } from "i18next";
import { initReactI18next } from "react-i18next";
import { locale } from "./locale.js";
import { gettextLookup, ngettextLookup, npgettextLookup, pgettextLookup } from "./lookup.js";

type GettextFormat = I18nFormatModule & {
    addLookupKeys(): void;
    getResource(language: string, namespace: string, msgid: string, options: TOptions): string;
    handleAsObject: boolean;
};

const gettextFormat: GettextFormat = {
    type: "i18nFormat",
    handleAsObject: false,
    addLookupKeys() {
        return;
    },
    getResource(_language, _namespace, msgid, options) {
        return pointLookup(msgid, options);
    },
};

/**
 * The initialized i18next instance used by {@link useTranslation}. Its lookups resolve synchronously
 * through the process-wide gettext domain; the language must be selected before the process starts.
 */
const i18n: I18n = createI18n();

const getContext = (value: unknown): string | undefined => {
    if (typeof value !== "string" && typeof value !== "number") {
        return undefined;
    }

    const context = String(value);

    return context.length === 0 ? undefined : context;
};

const pluralLookup = (msgid: string, msgidPlural: string, count: number, context?: string): string =>
    context === undefined
        ? ngettextLookup(msgid, msgidPlural, count)
        : npgettextLookup(context, msgid, msgidPlural, count);

const pointLookup = (msgid: string, options: TOptions): string => {
    const context = getContext(options.context);

    if (options.count !== undefined && typeof options.defaultValue === "string") {
        return pluralLookup(msgid, options.defaultValue, options.count, context);
    }

    return context === undefined ? gettextLookup(msgid) : pgettextLookup(context, msgid);
};

function createI18n(): I18n {
    const instance = createInstance();
    instance.use(gettextFormat).use(initReactI18next);

    void instance.init({
        defaultNS: "translation",
        fallbackLng: false,
        initAsync: false,
        interpolation: { escapeValue: false },
        keySeparator: false,
        lng: locale,
        ns: ["translation"],
        nsSeparator: false,
    });

    return instance;
}

export { i18n };

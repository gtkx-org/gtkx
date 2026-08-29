import type { I18nFormatModule, TOptions } from "i18next";
import i18next from "i18next";
import { initReactI18next } from "react-i18next";
import {
    GETTEXT_RESOURCE_KEY,
    gettextBackend,
    type GettextCatalog,
    isGettextCatalog,
} from "./backend.js";
import { locale } from "./locale.js";

type GettextFormat = I18nFormatModule & {
    addLookupKeys(): void;
    getResource(language: string, namespace: string, msgid: string, options: TOptions): string | undefined;
    handleAsObject: boolean;
};

type PluralLookup = {
    catalog: GettextCatalog;
    context: string | undefined;
    count: number;
    msgid: string;
    msgidPlural: string;
};

const gettextFormat: GettextFormat = {
    type: "i18nFormat",
    handleAsObject: false,
    addLookupKeys() {
        return;
    },
    getResource(language, namespace, msgid, options) {
        const resource: unknown = i18next.getResource(language, namespace, GETTEXT_RESOURCE_KEY, {
            keySeparator: false,
        });

        if (!isGettextCatalog(resource)) {
            return;
        }

        return pointLookup(resource, msgid, options);
    },
};

const getContext = (value: unknown): string | undefined => {
    if (typeof value !== "string" && typeof value !== "number") {
        return undefined;
    }

    const context = String(value);

    return context.length === 0 ? undefined : context;
};

const pluralLookup = ({ catalog, context, count, msgid, msgidPlural }: PluralLookup): string => {
    if (context === undefined) {
        return catalog.ngettext(msgid, msgidPlural, count);
    }

    const contextual = catalog.npgettext(context, msgid, msgidPlural, count);

    return contextual === msgid || contextual === msgidPlural
        ? catalog.ngettext(msgid, msgidPlural, count)
        : contextual;
};

const stringOption = (options: TOptions, key: string): string | undefined => {
    const value = options[key];

    return typeof value === "string" ? value : undefined;
};

const assertSupportedPluralOptions = (options: TOptions): void => {
    if (options.ordinal === true || stringOption(options, "defaultValue_zero") !== undefined) {
        throw new RangeError("GNU gettext does not support ordinal or zero-specific plural forms");
    }
};

const pluralSources = (msgid: string, options: TOptions): { plural: string; singular: string } => {
    assertSupportedPluralOptions(options);
    const defaultValue = stringOption(options, "defaultValue");
    const defaultValueOne = stringOption(options, "defaultValue_one");
    const defaultValueOther = stringOption(options, "defaultValue_other");
    const hasPluralDefaults = defaultValueOne !== undefined || defaultValueOther !== undefined;

    if (!hasPluralDefaults) {
        return { plural: defaultValue ?? msgid, singular: msgid };
    }

    return {
        plural: defaultValueOther ?? defaultValue ?? msgid,
        singular: defaultValueOne ?? defaultValue ?? msgid,
    };
};

const pluralPointLookup = (
    catalog: GettextCatalog,
    msgid: string,
    options: TOptions,
    count: number,
): string => {
    const { plural, singular } = pluralSources(msgid, options);

    return pluralLookup({
        catalog,
        context: getContext(options.context),
        count,
        msgid: singular,
        msgidPlural: plural,
    });
};

const contextualLookup = (
    catalog: GettextCatalog,
    source: string,
    context: string | undefined,
): string => {
    if (context === undefined) {
        return catalog.gettext(source);
    }

    const translated = catalog.pgettext(context, source);

    return translated === source ? catalog.gettext(source) : translated;
};

const singularPointLookup = (
    catalog: GettextCatalog,
    msgid: string,
    options: TOptions,
): string | undefined => {
    const source = stringOption(options, "defaultValue") ?? msgid;
    const translated = contextualLookup(catalog, source, getContext(options.context));

    return translated === source ? undefined : translated;
};

const pointLookup = (catalog: GettextCatalog, msgid: string, options: TOptions): string | undefined => {
    if (typeof options.count === "number") {
        return pluralPointLookup(catalog, msgid, options, options.count);
    }

    return singularPointLookup(catalog, msgid, options);
};

i18next.use(gettextBackend).use(gettextFormat).use(initReactI18next);

void i18next.init({
    defaultNS: "translation",
    fallbackLng: false,
    initAsync: false,
    interpolation: { escapeValue: false },
    contextSeparator: "\u{4}",
    keySeparator: ".",
    lng: locale,
    ns: ["translation"],
    nsSeparator: false,
});

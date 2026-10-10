import { t } from "@gtkx/runtime";
import { existsSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { applicationId, localeDir } from "virtual:gtkx-config";

const LIBC = "libc.so.6";
const LC_ALL = 6;
const GETTEXT_CODESET = ["UTF", "8"].join("-");
const setLocaleBinding = t.bind(LIBC, "setlocale", [t.int32, t.string()], t.string());
const bindTextDomainBinding = t.bind(LIBC, "bindtextdomain", [t.string(), t.string()], t.string());

const bindTextDomainCodesetBinding = t.bind(LIBC, "bind_textdomain_codeset", [t.string(), t.string()], t.string());

const textDomainBinding = t.bind(LIBC, "textdomain", [t.string()], t.string());
const locale: string = initializeLocale();

function requireStringResult(result: unknown): string {
    if (typeof result !== "string") {
        throw new TypeError("Unable to initialize the process locale");
    }

    return result;
}

function initializeLocale(): string {
    const directory = localeDir ?? bundledLocaleDir();
    requireStringResult(setLocaleBinding(LC_ALL, ""));
    requireStringResult(bindTextDomainBinding(applicationId, directory));
    requireStringResult(bindTextDomainCodesetBinding(applicationId, GETTEXT_CODESET));
    requireStringResult(textDomainBinding(applicationId));

    return new Intl.NumberFormat().resolvedOptions().locale;
}

function bundledLocaleDir(): string {
    const configUrl = new URL("gtkx-i18n.json", import.meta.url);

    if (!existsSync(configUrl)) {
        return fileURLToPath(new URL("locale", configUrl));
    }

    const config: unknown = JSON.parse(readFileSync(configUrl, "utf8"));

    if (
        typeof config !== "object" ||
        config === null ||
        !("localeDir" in config) ||
        typeof config.localeDir !== "string"
    ) {
        throw new TypeError("Invalid GTKX locale configuration");
    }

    return fileURLToPath(new URL(config.localeDir, configUrl));
}

export { locale };

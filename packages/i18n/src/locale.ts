import { t } from "@gtkx/runtime";
import { fileURLToPath } from "node:url";
import { applicationId } from "virtual:gtkx-config";

const LIBC = "libc.so.6";
const LC_ALL = 6;
const GETTEXT_CODESET = ["UTF", "8"].join("-");
const setLocaleBinding = t.bind(LIBC, "setlocale", [t.int32, t.string()], t.string());
const bindTextDomainBinding = t.bind(LIBC, "bindtextdomain", [t.string(), t.string()], t.string());

const bindTextDomainCodesetBinding = t.bind(
    LIBC,
    "bind_textdomain_codeset",
    [t.string(), t.string()],
    t.string(),
);

const textDomainBinding = t.bind(LIBC, "textdomain", [t.string()], t.string());
const locale: string = initializeLocale();

function requireStringResult(result: unknown): string {
    if (typeof result !== "string") {
        throw new TypeError("Unable to initialize the process locale");
    }

    return result;
}

function initializeLocale(): string {
    const localeDir = process.env.GTKX_LOCALE_DIR ?? fileURLToPath(new URL("locale", import.meta.url));
    const initialized = requireStringResult(setLocaleBinding(LC_ALL, ""));
    requireStringResult(bindTextDomainBinding(applicationId, localeDir));
    requireStringResult(bindTextDomainCodesetBinding(applicationId, GETTEXT_CODESET));
    requireStringResult(textDomainBinding(applicationId));

    return initialized;
}

export { locale };

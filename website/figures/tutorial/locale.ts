/// <reference types="@gtkx/react/env" />

import { t } from "@gtkx/runtime";
import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { translationDomain } from "virtual:gtkx-config";

const LIBC = "libc.so.6";
const LC_MESSAGES = 5;

const setLocale = t.bind(LIBC, "setlocale", [t.int32, t.string()], t.string());
const bindTextDomain = t.bind(
    LIBC,
    "bindtextdomain",
    [t.string(), t.string()],
    t.string(),
);

const startupLanguage = process.env.LANGUAGE;
const localeDirs: string[] = [];

const selectMessages = (locale: string): void => {
    if (typeof setLocale(LC_MESSAGES, locale) !== "string") {
        throw new Error(`The ${locale || "startup"} locale is not installed`);
    }
};

/**
 * Translates the figure run's messages with a PO catalog, as an app started
 * under that locale would be. Figures start in the C locale and gettext keeps
 * that choice for the process, so the catalog is compiled into a temporary
 * locale directory and the messages locale is switched in place until
 * {@link restoreMessages}.
 *
 * @param catalog The PO file to compile.
 * @param language The gettext language, such as `fr`.
 * @param locale An installed locale for that language, such as `fr_FR.UTF-8`.
 */
export function translateMessages(
    catalog: string,
    language: string,
    locale: string,
): void {
    const localeDir = mkdtempSync(join(tmpdir(), "gtkx-figures-locale-"));
    localeDirs.push(localeDir);
    const messages = join(localeDir, language, "LC_MESSAGES");
    mkdirSync(messages, { recursive: true });
    execFileSync("msgfmt", [
        "--check",
        "-o",
        join(messages, `${translationDomain}.mo`),
        catalog,
    ]);
    bindTextDomain(translationDomain, localeDir);
    process.env.LANGUAGE = language;
    selectMessages(locale);
}

/** Returns the figure run's messages to the startup environment's locale. */
export function restoreMessages(): void {
    if (startupLanguage === undefined) {
        delete process.env.LANGUAGE;
    } else {
        process.env.LANGUAGE = startupLanguage;
    }
    selectMessages("");
    for (const localeDir of localeDirs.splice(0)) {
        rmSync(localeDir, { recursive: true, force: true });
    }
}

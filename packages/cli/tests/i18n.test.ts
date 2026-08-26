import { spawnSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
    type CliProject,
    createCliProject,
    removeCliProject,
    runCliOrThrow,
} from "./cli-project.js";

type CatalogFailure = {
    linguas: string;
    po: string | null;
};

type AppRun = {
    status: number | null;
    stderr: string;
    stdout: string;
};

const APPLICATION_ID = "com.gtkx.clii18n";
const BUNDLE = join("dist", "bundle.mjs");
const POT = join("po", `${APPLICATION_ID}.pot`);
const POTFILES = join("po", "POTFILES.in");
const IT_CATALOG = join("po", "it.po");
const IT_MO = join("dist", "locale", "it", "LC_MESSAGES", `${APPLICATION_ID}.mo`);
const ENTRY = join("src", "index.ts");
const LAZY = join("src", "lazy.ts");
const UNREACHABLE = join("src", "unreachable.tsx");
const RUN_TIMEOUT = 60_000;

const CONFIG = `export default {
    applicationId: "${APPLICATION_ID}",
    codegen: false,
    reactCompiler: false,
};
`;

const ENTRY_SOURCE = `import { gettext, ngettext } from "@gtkx/i18n";

const { translatedLazy } = await import("./lazy.js");
process.stdout.write([
    gettext("Hello"),
    ngettext("One file", "Many files", 2),
    translatedLazy(),
].join("|"));
`;

const LAZY_SOURCE = `import { gettext } from "@gtkx/i18n";

const t = gettext;
const translatedLazy = (): string => t("Lazy message");

export { translatedLazy };
`;

const UNREACHABLE_SOURCE = `import { gettext } from "@gtkx/i18n";

export const unreachable = gettext("Unreachable message");
`;

const IT_PO = String.raw`msgid ""
msgstr ""
"Project-Id-Version: gtkx-cli-i18n\n"
"PO-Revision-Date: 2026-08-26 00:00+0000\n"
"Last-Translator: GTKX Tests <tests@gtkx.dev>\n"
"Language: it\n"
"Language-Team: Italian\n"
"MIME-Version: 1.0\n"
"Content-Type: text/plain; charset=UTF-8\n"
"Content-Transfer-Encoding: 8bit\n"
"Plural-Forms: nplurals=2; plural=(n != 1);\n"

msgid "Hello"
msgstr "Ciao"

msgid "One file"
msgid_plural "Many files"
msgstr[0] "Un file"
msgstr[1] "Molti file"

msgid "Lazy message"
msgstr "Messaggio differito"
`;

const projectFiles = (linguas: string, po: string | null): Record<string, string> => ({
    [ENTRY]: ENTRY_SOURCE,
    [LAZY]: LAZY_SOURCE,
    [UNREACHABLE]: UNREACHABLE_SOURCE,
    [join("po", "LINGUAS")]: linguas,
    ...(po !== null && { [IT_CATALOG]: po }),
});

const createI18nProject = (linguas = "it\n", po: string | null = IT_PO): CliProject =>
    createCliProject({
        prefix: "gtkx-cli-i18n-",
        config: CONFIG,
        files: projectFiles(linguas, po),
    });

const runBuiltApp = (project: CliProject): AppRun => {
    const result = spawnSync(process.execPath, [join(project.root, BUNDLE)], {
        cwd: tmpdir(),
        encoding: "utf8",
        env: {
            ...process.env,
            LANG: "it_IT.UTF-8",
            LANGUAGE: "it",
            LC_ALL: "it_IT.UTF-8",
        },
        timeout: RUN_TIMEOUT,
    });

    return { status: result.status, stderr: result.stderr, stdout: result.stdout };
};

const withProject = (project: CliProject, run: (project: CliProject) => void): void => {
    try {
        run(project);
    } finally {
        removeCliProject(project);
    }
};

describe("CLI gettext catalogs", () => {
    it("extracts reachable chunks, compiles catalogs, and translates the built app", () => {
        withProject(createI18nProject(), (project) => {
            runCliOrThrow(project, ["build"]);
            expect(readFileSync(join(project.root, POTFILES), "utf8")).toBe("src/index.ts\nsrc/lazy.ts\n");
            const pot = readFileSync(join(project.root, POT), "utf8");
            expect(pot).toContain('msgid "Hello"');
            expect(pot).toContain('msgid "One file"');
            expect(pot).toContain('msgid_plural "Many files"');
            expect(pot).toContain('msgid "Lazy message"');
            expect(pot).not.toContain("Unreachable message");
            expect(existsSync(join(project.root, IT_MO))).toBe(true);
            const result = runBuiltApp(project);
            expect(result.stderr).toBe("");
            expect(result.stdout).toBe("Ciao|Molti file|Messaggio differito");
            expect(result.status).toBe(0);
        });
    });

    it("accepts an empty LINGUAS file", () => {
        withProject(createI18nProject("", null), (project) => {
            runCliOrThrow(project, ["build"]);
            expect(readFileSync(join(project.root, POTFILES), "utf8")).toBe("src/index.ts\nsrc/lazy.ts\n");
            expect(existsSync(join(project.root, POT))).toBe(true);
            expect(existsSync(join(project.root, "dist", "locale"))).toBe(false);
        });
    });

    it("fails for unsafe, missing, and malformed catalogs", () => {
        const failures: CatalogFailure[] = [
            { linguas: "../it\n", po: IT_PO },
            { linguas: "it\n", po: null },
            { linguas: "it\n", po: 'msgid "unterminated\n' },
        ];

        for (const failure of failures) {
            withProject(createI18nProject(failure.linguas, failure.po), (project) => {
                expect(() => runCliOrThrow(project, ["build"])).toThrow();
            });
        }
    });
});

import { spawnSync } from "node:child_process";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import {
    type CliProject,
    createCliProject,
    removeCliProject,
    runCliOrThrow,
} from "./cli-project.js";

const APPLICATION_ID = "com.gtkx.clii18n";
const BUNDLE = join("dist", "bundle.mjs");
const POT = join("po", `${APPLICATION_ID}.pot`);
const POTFILES = join("po", "POTFILES.in");
const IT_CATALOG = join("po", "it.po");
const IT_MO = join("dist", "locale", "it", "LC_MESSAGES", `${APPLICATION_ID}.mo`);
const GENERATED_ENV = join("node_modules", ".gtkx", "env.d.ts");
const GENERATED_I18N_TYPES = join("node_modules", ".gtkx", "i18n.d.ts");
const GENERATED_I18N_RESOURCES = join("node_modules", ".gtkx", "i18n-resources.d.ts");
const GENERATED_EN_MESSAGES = join("node_modules", ".gtkx", "i18n", "en", "translation.json");
const TYPESCRIPT_CLI = fileURLToPath(new URL("../../../node_modules/typescript/bin/tsc", import.meta.url));
const ENTRY = join("src", "index.ts");
const RUN_TIMEOUT = 60_000;

const CONFIG = `export default {
    applicationId: "${APPLICATION_ID}",
    codegen: false,
    reactCompiler: false,
};
`;

const ENTRY_SOURCE = `import { t } from "@gtkx/i18n";

const { translatedLazy } = await import("./lazy.js");
process.stdout.write([
    t("Hello"),
    t("Welcome, {{name}}!", { name: "Ada" }),
    t("files", {
        count: 2,
        defaultValue_one: "{{count}} file",
        defaultValue_other: "{{count}} files",
    }),
    t("Open", { context: "menu" }),
    translatedLazy(),
].join("|"));
`;

const LAZY_SOURCE = `import { t } from "@gtkx/i18n";

export const translatedLazy = (): string => t("Lazy message");
`;

const REACT_SOURCE = `import { Trans, TransWithoutContext, useTranslation } from "@gtkx/i18n";

export const HookProbe = (): string => {
    const { t } = useTranslation();
    return t("Hook message");
};

export const component = <Trans i18nKey="component-welcome">Component welcome</Trans>;
export const contextFree = (
    <TransWithoutContext i18nKey="context-free-welcome">
        Context-free welcome
    </TransWithoutContext>
);
`;

const IGNORED_SOURCE = `import { t as translate } from "@gtkx/i18n";
import i18next from "i18next";

const key = process.argv[2] ?? "Local message";
const t = (message: string | TemplateStringsArray): string =>
    typeof message === "string" ? message : message[0] ?? "";
const localTranslate = t;
const instance = { t: (message: string): string => message };
const shadowedAlias = (translate: (message: string) => string): string => translate(key);
const shadowedMember = (i18next: typeof instance): string => i18next.t(key);
t(key);
t("Open", { context: "fake" });
t("Shared", { defaultValue: "Local source" });
t\`Local tagged message\`;
localTranslate("Local alias message");
instance.t("Member message");
shadowedAlias(t);
shadowedMember(instance);
`;

const LOCAL_TRANS_SOURCE = [
    'const key = process.argv[2] ?? "Local component";',
    'const value = "Local child";',
    "const Trans = (_props: { i18nKey?: string; children?: unknown }): null => null;",
    "export const local = <Trans i18nKey={key} />;",
    "export const localChildren = <Trans>{value}</Trans>;",
    "",
].join("\n");

const CJS_SOURCE = `const { t } = require("@gtkx/i18n");
t("CommonJS message");
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

msgid "Welcome, {{name}}!"
msgstr "Benvenuta, {{name}}!"

msgid "{{count}} file"
msgid_plural "{{count}} files"
msgstr[0] "{{count}} file"
msgstr[1] "{{count}} file"

msgctxt "menu"
msgid "Open"
msgstr "Apri"

msgid "Lazy message"
msgstr "Messaggio differito"

msgid "Removed message"
msgstr "Messaggio rimosso"
`;

const projectFiles = (linguas: string, po: string | null): Record<string, string> => ({
    [ENTRY]: ENTRY_SOURCE,
    [join("src", "components.tsx")]: REACT_SOURCE,
    [join("src", "ignored.ts")]: IGNORED_SOURCE,
    [join("src", "local-component.tsx")]: LOCAL_TRANS_SOURCE,
    [join("src", "lazy.ts")]: LAZY_SOURCE,
    [join("src", "legacy.cjs")]: CJS_SOURCE,
    [join("po", "LINGUAS")]: linguas,
    ...(po !== null && { [IT_CATALOG]: po }),
});

const createI18nProject = (linguas = "it\n", po: string | null = IT_PO): CliProject =>
    createCliProject({
        prefix: "gtkx-cli-i18n-",
        config: CONFIG,
        files: projectFiles(linguas, po),
    });

const withProject = (project: CliProject, run: (project: CliProject) => void): void => {
    try {
        run(project);
    } finally {
        removeCliProject(project);
    }
};

const runBuiltApp = (project: CliProject): string => {
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

    if (result.status !== 0) {
        throw new Error(result.stderr || result.stdout);
    }

    return result.stdout;
};

const typecheckConfig = (source: string): string =>
    `${JSON.stringify({
        compilerOptions: {
            module: "ESNext",
            moduleResolution: "Bundler",
            noEmit: true,
            skipLibCheck: true,
            strict: true,
        },
        files: [GENERATED_ENV, source],
    }, null, 4)}\n`;

const expectTypecheckToThrow = (project: CliProject): void => {
    const source = join("src", "unknown-message.ts");
    const config = "tsconfig.invalid.json";
    writeFileSync(join(project.root, source), "import { t } from \"@gtkx/i18n\";\nt(\"Unknown message\");\n");
    writeFileSync(join(project.root, config), typecheckConfig(source));

    expect(() => {
        const result = spawnSync(process.execPath, [TYPESCRIPT_CLI, "-p", config], {
            cwd: project.root,
            encoding: "utf8",
            timeout: RUN_TIMEOUT,
        });

        if (result.status !== 0) {
            throw new Error(result.stderr || result.stdout);
        }
    }).toThrow();
};

const expectExtractedMessages = (project: CliProject): void => {
    const pot = readFileSync(join(project.root, POT), "utf8");
    const resources = readFileSync(join(project.root, GENERATED_EN_MESSAGES), "utf8");
    const resourceTypes = readFileSync(join(project.root, GENERATED_I18N_RESOURCES), "utf8");
    expect(pot).toContain('msgid "Hello"');
    expect(pot).toContain('msgid "Welcome, {{name}}!"');
    expect(pot).toContain('msgid "{{count}} file"');
    expect(pot).toContain('msgid_plural "{{count}} files"');
    expect(pot).toContain('msgctxt "menu"');
    expect(pot).not.toContain('msgctxt "fake"');
    expect(pot).not.toContain('msgid "Local source"');
    expect(pot).not.toContain('msgid "Local tagged message"');
    expect(pot).not.toContain('msgid "Local alias message"');
    expect(pot).toContain('msgid "Lazy message"');
    expect(pot).toContain('msgid "Hook message"');
    expect(pot).toContain('msgid "Component welcome"');
    expect(pot).toContain('msgid "Context-free welcome"');
    expect(pot).not.toContain("Member message");
    expect(pot).not.toContain("CommonJS message");
    expect(resources).toContain("Hello");
    expect(resources).not.toContain("Local message");
    expect(resources).not.toContain("Local source");
    expect(resources).not.toContain("Local tagged message");
    expect(resources).not.toContain("Local alias message");
    expect(resources).not.toContain("Member message");
    expect(resourceTypes).toContain("Hello");
    expect(resourceTypes).not.toContain("Local source");
};

const expectBuiltCatalog = (project: CliProject): void => {
    const potfiles = readFileSync(join(project.root, POTFILES), "utf8");
    expect(potfiles).toContain("src/index.ts\n");
    expect(potfiles).not.toContain("legacy.cjs");

    expect(readFileSync(join(project.root, IT_CATALOG), "utf8")).toContain(
        '#~ msgid "Removed message"',
    );

    expect(existsSync(join(project.root, GENERATED_I18N_TYPES))).toBe(true);
    expect(existsSync(join(project.root, IT_MO))).toBe(true);
    expect(runBuiltApp(project)).toBe("Ciao|Benvenuta, Ada!|2 file|Apri|Messaggio differito");
};

const expectHappyPath = (): void => {
    withProject(createI18nProject(), (project) => {
        runCliOrThrow(project, ["build"]);
        expectExtractedMessages(project);
        expectBuiltCatalog(project);
    });
};

const expectEdgeCases = (): void => {
    withProject(createI18nProject("it\n", null), (project) => {
        runCliOrThrow(project, ["build"]);
        const catalog = readFileSync(join(project.root, IT_CATALOG), "utf8");
        expect(catalog).toContain(String.raw`"Language: it\n"`);
        expect(catalog).toContain('msgid "Hello"');
        expect(existsSync(join(project.root, IT_MO))).toBe(true);
    });

    withProject(createI18nProject("", null), (project) => {
        writeFileSync(join(project.root, ENTRY), `import { t, useTranslation } from "@gtkx/i18n";

t("settings", { context: "menu", keyPrefix: "panel." });
t("Shared", { defaultValue: "Canonical source" });
t("Asserted message" as const);
t("outer", { defaultValue: "Outer $t(inner)" });
t("nested outer", { defaultValue: 'Outer $t(inner, { defaultValue: ")", context: "menu" })' });

export const tupleProbe = (): string => {
    const [t] = useTranslation();
    return t("Tuple hook message");
};

export const prefixedProbe = (): string => {
    const { t } = useTranslation("translation", { keyPrefix: "panel" });
    return t("title", { context: "menu" });
};
`);
        runCliOrThrow(project, ["build"]);
        const pot = readFileSync(join(project.root, POT), "utf8");
        expect(existsSync(join(project.root, POT))).toBe(true);
        expect(existsSync(join(project.root, "dist", "locale"))).toBe(false);
        expect(pot).toContain('msgid "panel.settings"');
        expect(pot).toContain('msgid "Canonical source"');
        expect(pot).toContain('msgid "Asserted message"');
        expect(pot).toContain('msgid "Tuple hook message"');
        expect(pot).toContain('msgid "panel.title"');
        expect(pot).toContain('msgid "inner"');
        expect(pot).toContain('msgid "inner_menu"');
        expect(pot).not.toContain('msgid "Local source"');
    });
};

const expectErrorPaths = (): void => {
    for (const [linguas, po] of [
        ["../it\n", IT_PO],
        ["it\n", 'msgid "unterminated\n'],
    ] as const) {
        withProject(createI18nProject(linguas, po), (project) => {
            expect(() => runCliOrThrow(project, ["build"])).toThrow();
        });
    }

    withProject(createI18nProject(), (project) => {
        writeFileSync(
            join(project.root, ENTRY),
            `import { t } from "@gtkx/i18n";
t("rank", {
    count: 1,
    defaultValue_ordinal_one: "first",
    defaultValue_ordinal_other: "{{count}}th",
    ordinal: true,
});
`,
        );

        expect(() => runCliOrThrow(project, ["build"])).toThrow();
    });

    for (const [file, source] of [
        [ENTRY, `import { t as translate } from "@gtkx/i18n";
translate("Aliased message");
`],
        [ENTRY, `import { t } from "@gtkx/i18n";
const translate = t;
translate("Local alias message");
`],
        [ENTRY, `import * as i18n from "@gtkx/i18n";
i18n.t("Member message");
`],
        [ENTRY, `import * as i18n from "@gtkx/i18n";
const { t } = i18n;
t("Destructured member message");
`],
        [ENTRY, `import { useTranslation as useT } from "@gtkx/i18n";
const { t } = useT();
t("Aliased hook message");
`],
        [ENTRY, `import { useTranslation } from "@gtkx/i18n";
const translate = useTranslation().t;
translate("Hook property alias message");
`],
        [ENTRY, `import { useTranslation } from "@gtkx/i18n";
const translation = useTranslation();
translation.t("Hook member message");
`],
        [ENTRY, `import { t } from "@gtkx/i18n";
const translate = t.bind(undefined);
translate("Bound alias message");
`],
        [ENTRY, `import { useTranslation } from "@gtkx/i18n";
const { t } = useTranslation("translation", { keyPrefix: "panel" });
t("title", { keyPrefix: "" });
`],
        [ENTRY, `import { t } from "@gtkx/i18n";
(t)("Wrapped callee message");
`],
        [ENTRY, `import { t } from "@gtkx/i18n";
t\`Tagged message\`;
`],
        [ENTRY, `import { t as translate } from "@gtkx/i18n";
translate\`Aliased tagged message\`;
`],
        [ENTRY, `import * as i18n from "@gtkx/i18n";
i18n.t\`Member tagged message\`;
`],
        [ENTRY, `import * as i18n from "@gtkx/i18n";
i18n?.t("Optional member message");
`],
        [ENTRY, `import { t } from "@gtkx/i18n";
const key = process.argv[2];
t(key);
`],
        [
            join("src", "components.tsx"),
            'import { Trans } from "@gtkx/i18n";\n' +
            "const key = process.argv[2];\n" +
            "export const Invalid = <Trans i18nKey={key}>fallback</Trans>;\n",
        ],
        [
            join("src", "components.tsx"),
            'import { Trans } from "@gtkx/i18n";\n' +
            "const context = process.argv[2];\n" +
            'export const Invalid = <Trans i18nKey="open" context={context}>Open</Trans>;\n',
        ],
        [
            join("src", "components.tsx"),
            'import { Trans } from "@gtkx/i18n";\n' +
            "const defaults = process.argv[2];\n" +
            'export const Invalid = <Trans i18nKey="greeting" defaults={defaults}>Visible child</Trans>;\n',
        ],
        [join("src", "components.tsx"), `import { Trans } from "@gtkx/i18n";
const context = process.argv[2];
export const Invalid = <Trans i18nKey="open" tOptions={{ context }}>Open</Trans>;
`],
        [join("src", "components.tsx"), `import { Trans } from "@gtkx/i18n";
const fallback = process.argv[2];
export const Invalid = (
    <Trans i18nKey="greeting" tOptions={{ defaultValue: fallback }}>Visible child</Trans>
);
`],
        [ENTRY, `import { t } from "@gtkx/i18n";
t("files", "files", { count: 2, defaultValue_few: "few files" });
`],
        [ENTRY, `import { t } from "@gtkx/i18n";
t("files", { count: 2, ["defaultValue_two"]: "paired files" });
`],
        [ENTRY, `import { t } from "@gtkx/i18n";
const defaults = { defaultValue_many: "many files" };
t("files", { count: 2, ...defaults });
`],
        [ENTRY, `import { t } from "@gtkx/i18n";
const options = { count: 2, defaultValue_one: "one", defaultValue_other: "many" };
t("files", options);
`],
        [ENTRY, `import { t } from "@gtkx/i18n";
t("open", { ["con" + "text"]: "menu" });
`],
        [ENTRY, `import { t } from "@gtkx/i18n";
t("files", ({
    count: 2,
    defaultValue_one: "one file",
    defaultValue_other: "many files",
    defaultValue_zero: "no files",
} as const));
`],
        [ENTRY, `import { t } from "@gtkx/i18n";
t(("Parenthesized message"));
`],
        [ENTRY, `import { t } from "@gtkx/i18n";
t("Satisfied message" satisfies string);
`],
        [join("src", "components.tsx"), `import { Trans } from "@gtkx/i18n";
export const Invalid = () => (
    <Trans i18nKey="files" count={2} tOptions={{ defaultValue_zero: "no files" }}>files</Trans>
);
`],
    ] as const) {
        withProject(createI18nProject(), (project) => {
            writeFileSync(join(project.root, file), source);
            expect(() => runCliOrThrow(project, ["build"])).toThrow();
        });
    }

    withProject(createI18nProject(), (project) => {
        writeFileSync(
            join(project.root, ENTRY),
            `import { t } from "@gtkx/i18n";
t("files", {
    count: 2,
    defaultValue_one: "{{count}} file",
    defaultValue_two: "{{count}} paired files",
    defaultValue_other: "{{count}} files",
});
`,
        );

        expect(() => runCliOrThrow(project, ["build"])).toThrow();
    });

    withProject(createI18nProject(), (project) => {
        runCliOrThrow(project, ["codegen"]);
        expectTypecheckToThrow(project);
    });
};

describe("CLI gettext catalogs", () => {
    it("extracts, types, compiles, and runs an ESM application", () => {
        expect.hasAssertions();
        expectHappyPath();
    });

    it("initializes missing catalogs and accepts no locales", () => {
        expect.hasAssertions();
        expectEdgeCases();
    });

    it("rejects invalid catalogs, unsupported plurals, and unknown typed keys", () => {
        expect.hasAssertions();
        expectErrorPaths();
    });
});

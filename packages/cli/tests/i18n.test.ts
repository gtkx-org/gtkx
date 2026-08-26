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
const GENERATED_ENV = join("node_modules", ".gtkx", "env.d.ts");
const GENERATED_I18N_TYPES = join("node_modules", ".gtkx", "i18n.d.ts");
const ENTRY = join("src", "index.ts");
const HASHBANG = join("src", "hashbang.mjs");
const LAZY = join("src", "lazy.ts");
const TRIVIA = join("src", "trivia.js");
const UNREACHABLE = join("src", "unreachable.tsx");
const TYPESCRIPT_CLI = fileURLToPath(new URL("../../../node_modules/typescript/bin/tsc", import.meta.url));
const RUN_TIMEOUT = 60_000;
const REMOVED_MESSAGE = "A message removed from the source";
const POT_CREATION_DATE = /^"POT-Creation-Date: .*\\n"$/m;
const STABLE_POT_CREATION_DATE = String.raw`"POT-Creation-Date: 1970-01-01 00:00+0000\n"`;

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
    t("stable greeting", { defaultValue: "Good morning, {{name}}!", name: "Ada" }),
    t("One file", "Many files", { count: 2 }),
    t("standard files", {
        count: 2,
        defaultValue_one: "{{count}} standard file",
        defaultValue_other: "{{count}} standard files",
    }),
    t("Open", { context: "menu" }),
    t(["Missing fallback", "Hello"]),
    translatedLazy(),
].join("|"));
`;

const LAZY_SOURCE = `import { t } from "@gtkx/i18n";

const translatedLazy = (): string => t("Lazy message");

export { translatedLazy };
`;

const UNREACHABLE_SOURCE = `
import {
    IcuTrans as ICU,
    Trans as Localized,
    TransWithoutContext as LocalizedWithoutContext,
    Translation as RenderTranslation,
    getI18n,
    init as initialize,
    t,
    t as directAlias,
    useTranslation as useLocale,
    withTranslation as localize,
    type WithTranslation,
} from "@gtkx/i18n";
import * as i18nApi from "@gtkx/i18n";

export const unreachable = t("Unreachable message");
export const direct = directAlias("Direct alias {{name}}", { name: "Ada" });
const firstAlias = directAlias;
const secondAlias = firstAlias;
export const chained = secondAlias("Chained alias message");
export const namespaceDirect = i18nApi.t("Namespace alias message");
export const instanceDirect = getI18n().t("Instance direct message");
export const optionalDirect = directAlias?.("Optional alias message");
export const directTuple = useLocale("translation")[0]("Direct tuple message");
const tupleResult = useLocale();
export const storedTuple = tupleResult[0]("Stored tuple message");
const cjsApi = require("@gtkx/i18n");
export const cjsNamespace = cjsApi.t("CJS namespace message");
const { t: cjsAlias } = require("@gtkx/i18n");
export const cjsDestructure = cjsAlias("CJS destructured message");
export const translatable = <Localized>Trans component message</Localized>;
export const contextFree = (
    <LocalizedWithoutContext>Context-free Trans message</LocalizedWithoutContext>
);
export const icu = (
    <ICU
        content={[]}
        defaultTranslation="ICU alias {{name}}"
        i18nKey="icu.alias"
        values={{ name: "Ada" }}
    />
);
export const fallback = t(
    ["Fallback primary {{name}}", "Fallback secondary {{name}}"],
    { name: "Ada" },
);
export const defaultFallback = t(
    ["Default fallback primary", "default.fallback"],
    { defaultValue: "Fallback for {{name}}", name: "Ada" },
);
export const pluralFallback = t(
    ["One fallback for {{name}}", "One alternate for {{name}}"],
    "Many fallback for {{name}}",
    { count: 2, name: "Ada" },
);
export const pluralDefaultsFallback = t(
    ["stable fallback primary", "stable fallback secondary"],
    {
        count: 2,
        defaultValue_one: "One stable fallback for {{name}}",
        defaultValue_other: "Many stable fallback for {{name}}",
        name: "Ada",
    },
);

export const Prefixed = (): string => {
    const { t: accountT } = useLocale("translation", { keyPrefix: "account" });
    accountT("override", { defaultValue: "Settings override", keyPrefix: "settings" });
    accountT("Hello", { keyPrefix: "" });
    return accountT("title", { defaultValue: "Account title" });
};

Localized({ context: "menu", defaults: "Direct context", i18nKey: "direct.context" });
Localized({
    count: 2,
    defaults: "One direct item",
    i18nKey: "direct.plural",
    tOptions: { defaultValue_other: "Many direct items" },
});

const HocProbe = ({ t: orange }: WithTranslation): string =>
    orange("Aliased HOC {{name}}", { name: "Lin" });

export const LocalizedHocProbe = localize()(HocProbe);
const BodyHocProbe = (props: WithTranslation): string => {
    const { t: melon } = props;
    return melon("Body HOC alias message");
};
const enhance = localize();
export const LocalizedBodyHocProbe = enhance(BodyHocProbe);

class ClassHocProbe {
    declare props: WithTranslation;

    render(): string {
        return this.props.t("Class HOC alias message");
    }
}

export const LocalizedClassHocProbe = localize()(ClassHocProbe);
const namedRender = (kiwi: typeof t): string => kiwi("Named render alias message");
export const renderProbe = (
    <RenderTranslation>
        {(pear) => pear("Aliased render {{name}}", { name: "Ken" })}
    </RenderTranslation>
);
export const namedRenderProbe = <RenderTranslation>__GTKX_NAMED_RENDER__</RenderTranslation>;

void initialize().then((grape) => grape("Aliased init {{name}}", { name: "Jo" }));
const initialized = await initialize();
initialized("Awaited init alias message");
const onInitialized = (_error: unknown, lemon: typeof t): void => {
    lemon("Named init alias message");
};
void initialize(onInitialized);

const translate = (message: string): string => message;
export const notATranslation = translate("Do not extract this string");
const shadow = (directAlias: (message: string) => string): string =>
    directAlias("Do not extract shadowed alias");
void shadow;
const useTranslation = () => ({ t: translate });
const { t: localT } = useTranslation();
localT("Do not extract local hook");
const Trans = ({ children }: { children: string }): string => children;
export const localTrans = <Trans>Do not extract local Trans</Trans>;
const unrelated = { getFixedT: () => translate };
const unrelatedFixedT = unrelated.getFixedT();
unrelatedFixedT("Do not extract unrelated getFixedT");
const fake = { getFixedT: (_language: unknown, _namespace: string) => translate };
const fakeFixedT = fake.getFixedT(null, "fake");
fakeFixedT("Do not extract argumented getFixedT");
let mutableAlias = directAlias;
mutableAlias("Do not extract mutable alias");
mutableAlias = translate;
`.replace("__GTKX_NAMED_RENDER__", "{namedRender}");

const HASHBANG_SOURCE = `#!/usr/bin/env node
import { t } from "@gtkx/i18n";

t("Hashbang message");
`;

const TRIVIA_SOURCE = [
    '\u{FEFF}import { t } from "@gtkx/i18n";\r',
    "// carriage return\r",
    't("BOM and CR message");\u{2028}',
    't("Unicode line message");\n',
].join("");

const VALID_TYPES_SOURCE = `import {
    IcuTrans as ICU,
    IcuTransWithoutContext as ICUWithoutContext,
    Trans as Localized,
    TransWithoutContext as LocalizedWithoutContext,
    Translation as RenderTranslation,
    getI18n,
    init as initialize,
    t as translateDirectly,
    useTranslation as useLocale,
    withTranslation as localize,
    type WithTranslation,
} from "@gtkx/i18n";
import { Component, createElement } from "react";

translateDirectly("Welcome, {{name}}!", { name: "Ada" });
translateDirectly("Welcome, {{name}}!", { replace: { name: "Ada" } });
translateDirectly("stable greeting", { defaultValue: "Good morning, {{name}}!", name: "Ada" });
translateDirectly("One file", "Many files", { count: 2 });
translateDirectly("standard files", {
    count: 2,
    defaultValue_one: "{{count}} standard file",
    defaultValue_other: "{{count}} standard files",
});
translateDirectly(["Fallback primary {{name}}", "Fallback secondary {{name}}"], { name: "Ada" });
translateDirectly(
    ["Default fallback primary", "default.fallback"],
    { defaultValue: "Fallback for {{name}}", name: "Ada" },
);
translateDirectly(
    ["Default fallback primary", "default.fallback"],
    "Fallback for {{name}}",
    { name: "Ada" },
);
translateDirectly(
    ["Default fallback primary", "default.fallback"],
    { defaultValue: "Fallback for {{name}}", name: "Ada", returnDetails: true },
).usedKey;
translateDirectly(
    ["One fallback for {{name}}", "One alternate for {{name}}"],
    "Many fallback for {{name}}",
    { count: 2, name: "Ada" },
);
translateDirectly(
    ["One fallback for {{name}}", "One alternate for {{name}}"],
    { count: 2, defaultValue: "Many fallback for {{name}}", name: "Ada" },
);
translateDirectly(
    ["One fallback for {{name}}", "One alternate for {{name}}"],
    { count: 2, defaultValue_other: "Many fallback for {{name}}", name: "Ada" },
);
translateDirectly(
    ["One fallback for {{name}}", "One alternate for {{name}}"],
    {
        count: 2,
        defaultValue_other: "Many fallback for {{name}}",
        name: "Ada",
        returnDetails: true,
    },
).usedKey;
translateDirectly(
    ["stable fallback primary", "stable fallback secondary"],
    {
        count: 2,
        defaultValue_one: "One stable fallback for {{name}}",
        defaultValue_other: "Many stable fallback for {{name}}",
        name: "Ada",
    },
);
translateDirectly(
    ["stable fallback primary", "stable fallback secondary"],
    {
        count: 2,
        defaultValue: "One stable fallback for {{name}}",
        defaultValue_other: "Many stable fallback for {{name}}",
        name: "Ada",
    },
);
translateDirectly(
    ["stable fallback primary", "stable fallback secondary"],
    {
        count: 2,
        defaultValue: "Many stable fallback for {{name}}",
        defaultValue_one: "One stable fallback for {{name}}",
        name: "Ada",
        returnDetails: true,
    },
).usedKey;
translateDirectly("Open");
translateDirectly(["Open", "Hello"]);
translateDirectly(["Open", "Close"], { context: "menu" });
translateDirectly("one only", { count: 2, defaultValue_one: "One-only {{count}}" });
translateDirectly("general plural", {
    count: 2,
    defaultValue: "Many general {{count}}",
    defaultValue_one: "One general {{count}}",
});
Localized({ i18nKey: "Hello", t: translateDirectly });
Localized<"Hello">({ i18nKey: "Hello", t: translateDirectly });
LocalizedWithoutContext({ i18nKey: "Hello", t: translateDirectly });
ICU({
    content: [],
    defaultTranslation: "ICU typed {{name}}",
    i18nKey: "icu.typed",
    t: translateDirectly,
    values: { name: "Ada" },
});
ICU<"icu.typed">({
    content: [],
    defaultTranslation: "ICU typed {{name}}",
    i18nKey: "icu.typed",
    t: translateDirectly,
    values: { name: "Ada" },
});
ICUWithoutContext({
    content: [],
    defaultTranslation: "ICU context-free {{name}}",
    i18nKey: "icu.context-free",
    t: translateDirectly,
    values: { name: "Ada" },
});

const HookProbe = (): string => {
    const { t: banana } = useLocale();
    return banana("Hook {{name}}", { name: "Grace" });
};

const PrefixedHookProbe = (): string => {
    const { t: accountT } = useLocale("translation", { keyPrefix: "account" });
    accountT("override", { defaultValue: "Settings override", keyPrefix: "settings" });
    accountT("Hello", { keyPrefix: "" });
    accountT(["first", "second"], { keyPrefix: "account" });
    return accountT("title", { defaultValue: "Account title" });
};

const EmptyPrefixProbe = (): string => {
    const { t: rootT } = useLocale("translation", { keyPrefix: "" });
    return rootT("Hello");
};

getI18n().t("Hello");
const fixedT = getI18n().getFixedT(null, "translation", "account");
fixedT("title", { defaultValue: "Account title" });
fixedT("override", { defaultValue: "Settings override", keyPrefix: "settings" });
fixedT("Hello", { keyPrefix: "" });

const HocProbe = ({ t: translate }: WithTranslation): string =>
    translate("HOC {{name}}", { name: "Lin" });

localize()(HocProbe);
RenderTranslation({ children: (pear) => pear("Render {{name}}", { name: "Ken" }) });
RenderTranslation({
    children: (_pear, { i18n, lng }) => {
        const language: string = lng;
        return language + ":" + i18n.t("Welcome, {{name}}!", { name: "Ada" });
    },
});
void initialize().then((grape) => grape("Welcome, {{name}}!", { name: "Jo" }));

type ManagedProps = WithTranslation & { defaulted: string; label: string };

class ManagedProbe extends Component<ManagedProps> {
    static defaultProps = { defaulted: "default" };

    render(): string {
        return this.props.label;
    }
}

createElement(localize()(ManagedProbe), { label: "managed" });

export { EmptyPrefixProbe, HookProbe };
`;

const INVALID_TYPES_SOURCES = [
    't("Welcome, {{name}}!");',
    't("stable greeting");',
    't("stable greeting", { defaultValue: "Good morning, {{name}}!" });',
    `t("standard files", {
    defaultValue_one: "{{count}} standard file",
    defaultValue_other: "{{count}} standard files",
});`,
    't("Open");',
    't("Hello", { count: 1 });',
    't("Unknown message");',
    't(["Fallback primary {{name}}", "Fallback secondary {{name}}"]);',
    `t(
    ["Default fallback primary", "default.fallback"],
    { defaultValue: "Fallback for {{name}}" },
);`,
    `t(
    ["Default fallback primary", "default.fallback"],
    { count: 1, defaultValue: "Fallback for {{name}}", name: "Ada" },
);`,
    `t(
    ["One fallback for {{name}}", "One alternate for {{name}}"],
    "Many fallback for {{name}}",
    { name: "Ada" },
);`,
    `t(
    ["One fallback for {{name}}", "One alternate for {{name}}"],
    "Many fallback for {{name}}",
    { count: 2 },
);`,
    `t(
    ["stable fallback primary", "stable fallback secondary"],
    {
        defaultValue_one: "One stable fallback for {{name}}",
        defaultValue_other: "Many stable fallback for {{name}}",
        name: "Ada",
    },
);`,
    `t(
    ["stable fallback primary", "stable fallback secondary"],
    {
        count: 2,
        defaultValue_one: "One stable fallback for {{name}}",
        defaultValue_other: "Many stable fallback for {{name}}",
    },
);`,
    't(["Open"]);',
    'getI18n().t("Unknown message");',
    'Translation({ children: (_translate, { i18n }) => i18n.t("Unknown message") });',
    'Translation({ children: (_translate, { i18n }) => i18n.t("Welcome, {{name}}!") });',
].map(
    (call) => `import { getI18n, t, Translation } from "@gtkx/i18n";\n\n${call}\n`,
);

const ORDINAL_SOURCE = `import { t } from "@gtkx/i18n";

t("rank", {
    count: 1,
    defaultValue_ordinal_one: "first",
    defaultValue_ordinal_other: "{{count}}th",
    ordinal: true,
});
`;

const UNPAIRED_PLURAL_SOURCE = `import { t } from "@gtkx/i18n";

t("{{count}} item", { count: 2 });
`;

const TAGGED_SOURCE = `import { t } from "@gtkx/i18n";

t\`Tagged message\`;
`;

const TRANS_COUNT_SOURCE = `import { Trans } from "@gtkx/i18n";

Trans({ count: 2, defaults: "Only one form", i18nKey: "incomplete.plural" });
`;

const ICU_COUNT_SOURCE = `import { IcuTrans } from "@gtkx/i18n";

IcuTrans({
    content: [],
    defaultTranslation: "{{count}} ICU items",
    i18nKey: "icu.count",
    values: { count: 2 },
});
`;

const DYNAMIC_PREFIX_SOURCE = `import { useTranslation } from "@gtkx/i18n";

const prefix = process.env.PREFIX;
const { t } = useTranslation("translation", { keyPrefix: prefix });
t("dynamic");
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

msgid "Good morning, {{name}}!"
msgstr "Buongiorno, {{name}}!"

msgid "One file"
msgid_plural "Many files"
msgstr[0] "Un file"
msgstr[1] "Molti file"

msgid "{{count}} standard file"
msgid_plural "{{count}} standard files"
msgstr[0] "{{count}} file standard"
msgstr[1] "{{count}} file standard"

msgid "Lazy message"
msgstr "Messaggio differito"

msgctxt "menu"
msgid "Open"
msgstr "Apri"

msgid "${REMOVED_MESSAGE}"
msgstr "Un messaggio rimosso"
`;

const projectFiles = (linguas: string, po: string | null): Record<string, string> => ({
    [ENTRY]: ENTRY_SOURCE,
    [HASHBANG]: HASHBANG_SOURCE,
    [LAZY]: LAZY_SOURCE,
    [TRIVIA]: TRIVIA_SOURCE,
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

const runTypecheckOrThrow = (project: CliProject, config: string): void => {
    const result = spawnSync(process.execPath, [TYPESCRIPT_CLI, "-p", config], {
        cwd: project.root,
        encoding: "utf8",
        timeout: RUN_TIMEOUT,
    });

    if (result.status !== 0) {
        throw new Error(result.stderr || result.stdout);
    }
};

const withProject = (project: CliProject, run: (project: CliProject) => void): void => {
    try {
        run(project);
    } finally {
        removeCliProject(project);
    }
};

const stabilizePotCreationDate = (path: string): void => {
    const catalog = readFileSync(path, "utf8");
    expect(catalog).toMatch(POT_CREATION_DATE);
    writeFileSync(path, catalog.replace(POT_CREATION_DATE, () => STABLE_POT_CREATION_DATE));
};

const expectCatalogRerunsAreStable = (project: CliProject): void => {
    const templatePath = join(project.root, POT);
    const catalogPath = join(project.root, IT_CATALOG);
    runCliOrThrow(project, ["codegen"]);
    stabilizePotCreationDate(templatePath);
    stabilizePotCreationDate(catalogPath);
    const template = readFileSync(templatePath);
    const catalog = readFileSync(catalogPath);
    runCliOrThrow(project, ["codegen"]);
    expect(readFileSync(templatePath).equals(template)).toBe(true);
    expect(readFileSync(catalogPath).equals(catalog)).toBe(true);
    runCliOrThrow(project, ["build"]);
    expect(readFileSync(templatePath).equals(template)).toBe(true);
    expect(readFileSync(catalogPath).equals(catalog)).toBe(true);
};

const expectFallbackArrayMessages = (pot: string): void => {
    expect(pot).toContain('msgid "Fallback for {{name}}"');
    expect(pot).toContain('msgid "One fallback for {{name}}"');
    expect(pot).toContain('msgid_plural "Many fallback for {{name}}"');
    expect(pot).toContain('msgid "One stable fallback for {{name}}"');
    expect(pot).toContain('msgid_plural "Many stable fallback for {{name}}"');
};

const expectExtractedMessages = (pot: string): void => {
    expect(pot).toContain('msgid "Hello"');
    expect(pot).toContain('msgid "Good morning, {{name}}!"');
    expect(pot).toContain('msgid "One file"');
    expect(pot).toContain('msgid_plural "Many files"');
    expect(pot).toContain('msgid "{{count}} standard file"');
    expect(pot).toContain('msgid_plural "{{count}} standard files"');
    expect(pot).toContain('msgid "Lazy message"');
    expect(pot).toContain('msgctxt "menu"');
    expect(pot).toContain('msgid "Unreachable message"');
    expect(pot).toContain('msgid "Trans component message"');
    expect(pot).toContain('msgid "Context-free Trans message"');
    expect(pot).toContain('msgid "Direct alias {{name}}"');
    expect(pot).toContain('msgid "ICU alias {{name}}"');
    expect(pot).toContain('msgid "Aliased HOC {{name}}"');
    expect(pot).toContain('msgid "Aliased render {{name}}"');
    expect(pot).toContain('msgid "Aliased init {{name}}"');
    expect(pot).toContain('msgid "Chained alias message"');
    expect(pot).toContain('msgid "Namespace alias message"');
    expect(pot).toContain('msgid "Instance direct message"');
    expect(pot).toContain('msgid "Body HOC alias message"');
    expect(pot).toContain('msgid "Class HOC alias message"');
    expect(pot).toContain('msgid "Named render alias message"');
    expect(pot).toContain('msgid "Awaited init alias message"');
    expect(pot).toContain('msgid "Named init alias message"');
    expect(pot).toContain('msgid "Optional alias message"');
    expect(pot).toContain('msgid "Direct tuple message"');
    expect(pot).toContain('msgid "Stored tuple message"');
    expect(pot).toContain('msgid "CJS namespace message"');
    expect(pot).toContain('msgid "CJS destructured message"');
    expect(pot).toContain('msgid "Hashbang message"');
    expect(pot).toContain('msgid "BOM and CR message"');
    expect(pot).toContain('msgid "Unicode line message"');
    expect(pot).toContain('msgid "Settings override"');
    expect(pot).toContain('msgid "Direct context"');
    expect(pot).toContain('msgid "One direct item"');
    expect(pot).toContain('msgid_plural "Many direct items"');
    expectFallbackArrayMessages(pot);
    expect(pot).not.toContain("Do not extract this string");
    expect(pot).not.toContain("Do not extract shadowed alias");
    expect(pot).not.toContain("Do not extract local hook");
    expect(pot).not.toContain("Do not extract local Trans");
    expect(pot).not.toContain("Do not extract unrelated getFixedT");
    expect(pot).not.toContain("Do not extract argumented getFixedT");
    expect(pot).not.toContain("Do not extract mutable alias");
    expect(pot).toContain('msgid "Account title"');
};

const expectBuiltCatalog = (project: CliProject): void => {
    expect(readFileSync(join(project.root, POTFILES), "utf8")).toBe(
        "src/hashbang.mjs\nsrc/index.ts\nsrc/lazy.ts\nsrc/trivia.js\nsrc/unreachable.tsx\n",
    );

    expectExtractedMessages(readFileSync(join(project.root, POT), "utf8"));
    const catalog = readFileSync(join(project.root, IT_CATALOG), "utf8");
    expect(catalog).toContain('msgid "Unreachable message"');
    expect(catalog).toContain(`#~ msgid "${REMOVED_MESSAGE}"`);
    expect(existsSync(join(project.root, IT_MO))).toBe(true);
    const result = runBuiltApp(project);
    expect(result.stderr).toBe("");

    expect(result.stdout).toBe(
        "Ciao|Benvenuta, Ada!|Buongiorno, Ada!|Molti file|2 file standard|Apri|Ciao|Messaggio differito",
    );

    expect(result.status).toBe(0);
};

const expectGeneratedTypes = (project: CliProject): void => {
    writeFileSync(join(project.root, "src", "types-valid.ts"), VALID_TYPES_SOURCE);
    writeFileSync(join(project.root, "tsconfig.valid.json"), typecheckConfig("src/types-valid.ts"));
    runCliOrThrow(project, ["codegen"]);
    const generated = readFileSync(join(project.root, GENERATED_I18N_TYPES), "utf8");
    expect(generated).toContain('"Welcome, {{name}}!"');
    expect(generated).toContain('kind: "plural"');
    expect(generated).toContain('kind: "pluralDefaults"');
    expect(generated).toContain('"Hook {{name}}"');
    expect(generated).toContain('"HOC {{name}}"');
    expect(generated).toContain('"Render {{name}}"');
    expect(generated).toContain('"ICU typed {{name}}"');
    expect(generated).toContain('"ICU context-free {{name}}"');
    expect(generated).toContain('"account.title"');
    expect(readFileSync(join(project.root, POT), "utf8")).not.toContain(STABLE_POT_CREATION_DATE);
    expect(readFileSync(join(project.root, IT_CATALOG), "utf8")).toContain('msgid "Hook {{name}}"');
    runTypecheckOrThrow(project, "tsconfig.valid.json");
};

const expectInitializedCatalog = (project: CliProject): void => {
    runCliOrThrow(project, ["codegen"]);
    const catalog = readFileSync(join(project.root, IT_CATALOG), "utf8");
    expect(catalog).toContain(String.raw`"Language: it\n"`);
    expect(catalog).toContain(String.raw`"Plural-Forms: nplurals=2; plural=(n != 1);\n"`);
    expect(catalog).toContain('msgid "Hello"');
    runCliOrThrow(project, ["build"]);
    expect(existsSync(join(project.root, IT_MO))).toBe(true);
};

const expectCatalogFailures = (): void => {
    const failures: CatalogFailure[] = [
        { linguas: "../it\n", po: IT_PO },
        { linguas: "it\n", po: 'msgid "unterminated\n' },
    ];

    for (const failure of failures) {
        withProject(createI18nProject(failure.linguas, failure.po), (project) => {
            expect(() => runCliOrThrow(project, ["build"])).toThrow();
        });
    }
};

const expectTypeFailures = (): void => {
    withProject(createI18nProject(), (project) => {
        runCliOrThrow(project, ["codegen"]);

        for (const [index, source] of INVALID_TYPES_SOURCES.entries()) {
            const path = `src/types-invalid-${String(index)}.ts`;
            const config = `tsconfig.invalid-${String(index)}.json`;
            writeFileSync(join(project.root, path), source);
            writeFileSync(join(project.root, config), typecheckConfig(path));

            expect(() => {
                runTypecheckOrThrow(project, config);
            }).toThrow();
        }
    });
};

const expectMessageFailures = (): void => {
    for (const source of [
        ORDINAL_SOURCE,
        UNPAIRED_PLURAL_SOURCE,
        TAGGED_SOURCE,
        TRANS_COUNT_SOURCE,
        ICU_COUNT_SOURCE,
        DYNAMIC_PREFIX_SOURCE,
    ]) {
        withProject(createI18nProject(), (project) => {
            writeFileSync(join(project.root, ENTRY), source);
            expect(() => runCliOrThrow(project, ["build"])).toThrow();
        });
    }
};

describe("CLI gettext catalogs", () => {
    it("extracts sources, generates types, and translates the built app", () => {
        withProject(createI18nProject(), (project) => {
            runCliOrThrow(project, ["build"]);
            expectBuiltCatalog(project);
            expectCatalogRerunsAreStable(project);
            expectGeneratedTypes(project);
        });
    });

    it("initializes a listed catalog and accepts an empty LINGUAS file", () => {
        withProject(createI18nProject("it\n", null), (project) => {
            expectInitializedCatalog(project);
        });

        withProject(createI18nProject("", null), (project) => {
            runCliOrThrow(project, ["build"]);
            expect(readFileSync(join(project.root, POTFILES), "utf8")).toContain("src/index.ts\n");
            expect(existsSync(join(project.root, POT))).toBe(true);
            expect(existsSync(join(project.root, "dist", "locale"))).toBe(false);
        });
    });

    it("rejects invalid catalogs, messages, and translation calls", () => {
        expectCatalogFailures();
        expectTypeFailures();
        expectMessageFailures();
    });
});

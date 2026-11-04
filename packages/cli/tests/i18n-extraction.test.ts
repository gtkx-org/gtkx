import { runCommand } from "citty";
import { po } from "gettext-parser";
import { readFileSync, statSync, utimesSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { createCommand } from "../dist/command.js";
import { createProject } from "./project.js";

const extract = async (root: string): Promise<void> => {
    await runCommand(createCommand(), { rawArgs: ["codegen", "--cwd", root] });
};

const readMessages = (root: string) =>
    Object.values(po.parse(readFileSync(join(root, "po/org.gtkx.example.pot"))).translations)
        .flatMap((context) => Object.values(context))
        .filter((message) => message.msgid.length > 0);

const T_IMPORT = 'import { t } from "@gtkx/i18n";';
const TRANS_IMPORT = 'import { Trans } from "@gtkx/i18n";';

describe("translation extraction", () => {
    it("merges repeated messages and preserves references to filenames containing spaces", async () => {
        using project = createProject();
        project.write("po/LINGUAS", "");
        project.write(
            "src/a.ts",
            `${T_IMPORT}\nt("first", "Shared text");\nt("button", "Open", { context: "button" });\nt("%s files");`,
        );
        project.write(
            "src/z space.ts",
            `${T_IMPORT}\nt("second", "Shared text");\nt("first", "Shared text");\nt("%s files");`,
        );

        await extract(project.root);

        expect(
            readMessages(project.root).map((message) => [
                message.msgctxt ?? "",
                message.msgid,
                message.comments?.reference?.replaceAll("\n", " "),
                message.comments?.flag ?? "",
            ]),
        ).toEqual([
            ["", "Shared text", "src/a.ts:2 \u2068src/z space.ts\u2069:2 \u2068src/z space.ts\u2069:3", ""],
            ["", "%s files", "src/a.ts:4 \u2068src/z space.ts\u2069:4", "javascript-format"],
            ["button", "Open", "src/a.ts:3", ""],
        ]);

        const path = join(project.root, "po/org.gtkx.example.pot");
        const previous = readFileSync(path, "utf8");
        const timestamp = new Date("2000-01-01T00:00:00Z");
        utimesSync(path, timestamp, timestamp);

        await extract(project.root);

        expect(readFileSync(path, "utf8")).toBe(previous);
        expect(statSync(path).mtimeMs).toBe(timestamp.getTime());
    });

    it("retains metadata comments and leaves unchanged catalog templates untouched", async () => {
        using project = createProject();
        project.write("po/LINGUAS", "");
        project.write("src/messages.ts", `${T_IMPORT}\nt("Source text");\nt("Metadata title");`);
        project.write(
            "po/org.gtkx.example.pot",
            `msgid ""
msgstr ""
"Content-Type: text/plain; charset=UTF-8\\n"

#. Application title
#: po/.gtkx-metadata/org.gtkx.example.template.desktop:1
msgid "Metadata title"
msgstr ""

#: src/removed.ts:1
msgid "Removed source"
msgstr ""
`,
        );

        await extract(project.root);

        expect(readMessages(project.root)).toEqual([
            expect.objectContaining({ msgid: "Source text", comments: { reference: "src/messages.ts:2" } }),
            expect.objectContaining({
                msgid: "Metadata title",
                comments: {
                    extracted: "Application title",
                    reference: "src/messages.ts:3 po/.gtkx-metadata/org.gtkx.example.template.desktop:1",
                },
            }),
        ]);

        const path = join(project.root, "po/org.gtkx.example.pot");
        const previous = readFileSync(path, "utf8").replace(
            /^"POT-Creation-Date: .*\\n"$/m,
            '"POT-Creation-Date: 2000-01-01 00:00+0000\\n"',
        );
        project.write("po/org.gtkx.example.pot", previous);
        const timestamp = new Date("2000-01-01T00:00:00Z");
        utimesSync(path, timestamp, timestamp);

        await extract(project.root);

        expect(readFileSync(path, "utf8")).toBe(previous);
        expect(statSync(path).mtimeMs).toBe(timestamp.getTime());
    });

    it("writes the same catalog template from codegen and deploy", async () => {
        using project = createProject({
            applicationIcon: "icon.svg",
            deploy: {
                name: "Example",
                summary: "Exercises the catalog template",
                categories: ["Utility"],
                keywords: ["example", "catalog"],
                description: ["An example application whose metadata shares the template with its source messages."],
                developer: { id: "dev.gtkx", name: "GTKX" },
                license: "MIT",
                node: { source: "host" },
            },
        });
        project.write("LICENSE", "MIT License\n");
        project.write(
            "icon.svg",
            '<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64"><rect width="64" height="64"/></svg>',
        );
        project.write("po/LINGUAS", "");
        project.write(
            "org.gtkx.example.gschema.xml",
            `<schemalist gettext-domain="org.gtkx.example"><schema id="org.gtkx.example" path="/org/gtkx/example/">
                <key name="count" type="u"><default>1</default><summary>Example count</summary></key>
            </schema></schemalist>`,
        );
        project.write(
            "src/messages.ts",
            `${T_IMPORT}\nimport "../org.gtkx.example.gschema.xml";\nt("Example");\nt("A source message long enough that GNU gettext wraps it across several lines of the template");`,
        );
        const path = join(project.root, "po/org.gtkx.example.pot");
        const deploy = () =>
            runCommand(createCommand(), {
                rawArgs: ["deploy", "--cwd", project.root, "--print-manifests", "--target", "deb"],
            });

        await deploy();
        expect(readFileSync(path, "utf8")).toMatch(/^#: org\.gtkx\.example\.gschema\.xml:2\nmsgid "Example count"$/m);
        const template = readFileSync(path, "utf8").replace(
            /^"POT-Creation-Date: .*\\n"$/m,
            '"POT-Creation-Date: 2000-01-01 00:00+0000\\n"',
        );
        project.write("po/org.gtkx.example.pot", template);
        const timestamp = new Date("2000-01-01T00:00:00Z");
        utimesSync(path, timestamp, timestamp);

        await extract(project.root);
        await deploy();

        expect(readFileSync(path, "utf8")).toBe(template);
        expect(statSync(path).mtimeMs).toBe(timestamp.getTime());
    });

    it("preserves source strings, contexts, plurals, references, and native format flags", async () => {
        using project = createProject();
        project.write("po/LINGUAS", "");
        project.write(
            "src/messages.tsx",
            [
                T_IMPORT,
                't("asserted" as const);',
                "t(`template`);",
                't("open", "Open", { context: "button" });',
                't("files", { count, defaultValue_one: "{{count}} file", defaultValue_other: "{{count}} files" });',
                't("%s files");',
                't("options", { interpolation() {} });',
            ].join("\n"),
        );

        await extract(project.root);

        expect(
            readMessages(project.root).map((message) => [
                message.msgctxt ?? "",
                message.msgid,
                message.msgid_plural ?? "",
                message.comments?.reference,
                message.comments?.flag ?? "",
            ]),
        ).toEqual([
            ["", "asserted", "", "src/messages.tsx:2", ""],
            ["", "template", "", "src/messages.tsx:3", ""],
            ["", "{{count}} file", "{{count}} files", "src/messages.tsx:5", ""],
            ["", "%s files", "", "src/messages.tsx:6", "javascript-format"],
            ["", "options", "", "src/messages.tsx:7", ""],
            ["button", "Open", "", "src/messages.tsx:4", ""],
        ]);
        expect(po.parse(readFileSync(join(project.root, "po/org.gtkx.example.pot"))).headers).toMatchObject({
            "Project-Id-Version": "org.gtkx.example",
        });
    });

    it("gives translators the Translators: comments that precede each message", async () => {
        using project = createProject();
        project.write("po/LINGUAS", "fr\n");
        project.write(
            "src/messages.tsx",
            `import { t, useTranslation, Trans } from "@gtkx/i18n";
// Translators: Default name of a new recording; {{index}} is its number.
const name = \`\${t("Recording {{index}}", { index })}.ogg\`;
/* Translators: shown for a recording modified
   the day before. */
t("Yesterday");
// Not for translators
t("Untagged");
// Translators: lost because code comes between
setTitle(
    t("Detached"));
const open = /* Translators: a menu command */ t("Open", { context: "menu" });
// Translators: {{count}} is the number of recordings
t("{{count}} recording", { count, defaultValue_one: "{{count}} recording", defaultValue_other: "{{count}} recordings" });
function About() {
    const { t } = useTranslation();
    return <AdwAboutDialog
        // Translators: Replace this with your names, one per line.
        translatorCredits={t("translator-credits")}
    >
        {/* Translators: the recording's file name follows */}
        <Trans i18nKey="renamed">Renamed</Trans>
    </AdwAboutDialog>;
}
// Translators: a second place that shows the same message
t("Yesterday");`,
        );

        await extract(project.root);

        expect(
            readMessages(project.root).map((message) => [
                message.msgctxt ?? "",
                message.msgid,
                message.comments?.extracted,
            ]),
        ).toEqual([
            ["", "Recording {{index}}", "Translators: Default name of a new recording; {{index}} is its number."],
            [
                "",
                "Yesterday",
                "Translators: shown for a recording modified\nthe day before.\nTranslators: a second place that shows the same message",
            ],
            ["", "Untagged", undefined],
            ["", "Detached", undefined],
            ["", "{{count}} recording", "Translators: {{count}} is the number of recordings"],
            ["", "translator-credits", "Translators: Replace this with your names, one per line."],
            ["", "Renamed", "Translators: the recording's file name follows"],
            ["menu", "Open", "Translators: a menu command"],
        ]);
        expect(
            po.parse(readFileSync(join(project.root, "po/fr.po"))).translations[""]?.["translator-credits"]?.comments
                ?.extracted,
        ).toBe("Translators: Replace this with your names, one per line.");

        const path = join(project.root, "po/org.gtkx.example.pot");
        const previous = readFileSync(path, "utf8");
        const timestamp = new Date("2000-01-01T00:00:00Z");
        utimesSync(path, timestamp, timestamp);

        await extract(project.root);

        expect(readFileSync(path, "utf8")).toBe(previous);
        expect(statSync(path).mtimeMs).toBe(timestamp.getTime());
    });

    it("keeps the messages of Storybook stories out of the catalogs", async () => {
        using project = createProject();
        project.write("po/LINGUAS", "fr\n");
        project.write(
            ".storybook/main.ts",
            'export default { stories: ["src/**/*.stories.tsx", "src/demos/*.tsx", "../ui/src/**/*.stories.tsx"] };',
        );
        project.write("src/button.tsx", `${T_IMPORT}\nexport const label = t("Save");`);
        project.write(
            "src/button.stories.tsx",
            `${T_IMPORT}\nexport default { args: { label: t("Save"), document: t("Story fixture document") } };`,
        );
        project.write("src/demos/gallery.tsx", `${T_IMPORT}\nexport const title = t("Demo gallery");`);

        await extract(project.root);

        expect(readMessages(project.root).map((message) => [message.msgid, message.comments?.reference])).toEqual([
            ["Save", "src/button.tsx:2"],
        ]);
        expect(Object.keys(po.parse(readFileSync(join(project.root, "po/fr.po"))).translations[""] ?? {})).toEqual([
            "",
            "Save",
        ]);
        expect(readFileSync(join(project.root, "po/POTFILES.in"), "utf8")).toBe("src/button.tsx\nsrc/index.ts\n");
        expect(readFileSync(join(project.root, "node_modules/.gtkx/i18n-resources.d.ts"), "utf8")).toContain(
            "Story fixture document",
        );
    });

    it("extracts the summaries and descriptions of imported GSettings schemas", async () => {
        using project = createProject();
        project.write("po/LINGUAS", "fr\n");
        project.write(
            "po/fr.po",
            `msgid ""
msgstr ""
"Language: fr\\n"
"MIME-Version: 1.0\\n"
"Content-Type: text/plain; charset=UTF-8\\n"
"Content-Transfer-Encoding: 8bit\\n"
"Plural-Forms: nplurals=2; plural=(n > 1);\\n"

msgid "Lap length"
msgstr "Durée d’un tour"
`,
        );
        project.write(
            "data/org.gtkx.example.gschema.xml",
            `<?xml version="1.0" encoding="UTF-8"?>
<schemalist gettext-domain="org.gtkx.example">
  <schema id="org.gtkx.example" path="/org/gtkx/example/">
    <key name="lap-length" type="u">
      <default>25</default>
      <!-- Translators: a lap is one work session -->
      <summary>Lap length</summary>
      <description>The length of a work lap in minutes.</description>
    </key>
  </schema>
</schemalist>
`,
        );
        project.write(
            "src/index.ts",
            `${T_IMPORT}\nimport settings from "../data/org.gtkx.example.gschema.xml";\nexport default [settings, t("Start")];`,
        );

        await extract(project.root);

        expect(
            readMessages(project.root).map((message) => [
                message.msgid,
                message.comments?.reference,
                message.comments?.extracted,
            ]),
        ).toEqual([
            ["Start", "src/index.ts:3", undefined],
            ["Lap length", "data/org.gtkx.example.gschema.xml:7", "Translators: a lap is one work session"],
            ["The length of a work lap in minutes.", "data/org.gtkx.example.gschema.xml:8", undefined],
        ]);
        expect(po.parse(readFileSync(join(project.root, "po/fr.po"))).translations[""]?.["Lap length"]?.msgstr).toEqual(
            ["Durée d’un tour"],
        );
        expect(readFileSync(join(project.root, "po/fr.po"), "utf8")).not.toContain("#~");
        expect(readFileSync(join(project.root, "po/POTFILES.in"), "utf8")).toBe(
            "data/org.gtkx.example.gschema.xml\nsrc/index.ts\n",
        );
    });

    it("extracts imported hooks and components while ignoring shadowed bindings", async () => {
        using project = createProject();
        project.write("po/LINGUAS", "");
        project.write(
            "src/messages.tsx",
            `import { t, useTranslation, Trans, TransWithoutContext } from "@gtkx/i18n";
t("Imported message");
function App() {
    const { t } = useTranslation("translation", { keyPrefix: "menu" });
    t("title", "Menu title");
    return <><Trans i18nKey="component" defaults="Component text" />
        <TransWithoutContext i18nKey="simple">Simple text</TransWithoutContext></>;
}
function Local(t, Trans) {
    t(dynamic, options);
    return <Trans {...props} />;
}`,
        );

        await extract(project.root);

        expect(readMessages(project.root).map((message) => [message.msgid, message.comments?.reference])).toEqual([
            ["Imported message", "src/messages.tsx:2"],
            ["Menu title", "src/messages.tsx:5"],
            ["Component text", "src/messages.tsx:6"],
            ["Simple text", "src/messages.tsx:7"],
        ]);
    });

    it.each([
        ["an imported alias", 'import { t as translate } from "@gtkx/i18n";\ntranslate("key");'],
        ["a local alias", `${T_IMPORT}\nconst translate = t; translate("key");`],
        [
            "an aliased hook",
            'import { useTranslation as useI18n } from "@gtkx/i18n";\nconst { t } = useI18n(); t("key");',
        ],
        ["a namespace member", 'import * as i18n from "@gtkx/i18n";\ni18n.t("key");'],
        [
            "the hook's i18n instance",
            'import { useTranslation } from "@gtkx/i18n";\nconst { i18n } = useTranslation(); i18n.t("key");',
        ],
        ["a wrapped callee", `${T_IMPORT}\n(t)("key");`],
        ["an optional call", `${T_IMPORT}\nt?.("key");`],
        ["a tagged template", `${T_IMPORT}\nt\`key\`;`],
        ["a dynamic key", `${T_IMPORT}\nt(key);`],
        ["a parenthesized key", `${T_IMPORT}\nt(("key"));`],
        ["a satisfies wrapper", `${T_IMPORT}\nt("key" satisfies string);`],
        ["a non-null wrapper", `${T_IMPORT}\nt("key"!);`],
        ["dynamic options", `${T_IMPORT}\nt("key", options);`],
        ["wrapped options", `${T_IMPORT}\nt("key", { defaultValue: "Hello" } as const);`],
        ["spread options", `${T_IMPORT}\nt("key", { ...options });`],
        ["a dynamic default", `${T_IMPORT}\nt("key", { defaultValue: value });`],
        ["a dynamic context", `${T_IMPORT}\nt("key", { context: value });`],
        ["a source string method", `${T_IMPORT}\nt("key", { defaultValue() {} });`],
        ["one source string for both plural forms", `${T_IMPORT}\nt("{{count}} day", "{{count}} days", { count });`],
        ["a count message without plural source strings", `${T_IMPORT}\nt("{{count}} installed", { count });`],
        [
            "a component alias",
            'import { Trans as Translation } from "@gtkx/i18n";\nconst element = <Translation i18nKey="key" />;',
        ],
        ["spread component properties", `${TRANS_IMPORT}\nconst element = <Trans i18nKey="key" {...props} />;`],
        ["a dynamic component key", `${TRANS_IMPORT}\nconst element = <Trans i18nKey={key} />;`],
    ])("rejects %s", async (_name, source) => {
        using project = createProject();
        project.write("po/LINGUAS", "");
        project.write("src/messages.tsx", source);

        await expect(extract(project.root)).rejects.toThrow();
    });

    it("reports every translation it cannot extract in one run", async () => {
        using project = createProject();
        project.write("po/LINGUAS", "");
        project.write("src/sidebar.tsx", `${T_IMPORT}\nt(first);\nt(second);`);
        project.write("src/window.tsx", `${T_IMPORT}\nt(third);`);

        const failure = extract(project.root);

        await expect(failure).rejects.toThrow("src/sidebar.tsx:2:3: Translation keys must be string literals");
        await expect(failure).rejects.toThrow("src/sidebar.tsx:3:3: Translation keys must be string literals");
        await expect(failure).rejects.toThrow("src/window.tsx:2:3: Translation keys must be string literals");
    });

    it("keeps written-out plural forms that read the same in English for languages that need two", async () => {
        using project = createProject();
        project.write("po/LINGUAS", "it\n");
        project.write(
            "src/messages.ts",
            `${T_IMPORT}\nt("{{count}} installed", { count, defaultValue_one: "{{count}} installed", defaultValue_other: "{{count}} installed" });`,
        );

        await extract(project.root);

        expect(readMessages(project.root).map((message) => [message.msgid, message.msgid_plural])).toEqual([
            ["{{count}} installed", "{{count}} installed"],
        ]);
        const italian = po.parse(readFileSync(join(project.root, "po/it.po")));
        expect(italian.headers["Plural-Forms"]).toMatch(/nplurals=2/);
        expect(italian.translations[""]?.["{{count}} installed"]).toMatchObject({
            msgid_plural: "{{count}} installed",
            msgstr: ["", ""],
        });
    });

    it("keeps a locale's catalog before the application has any messages", async () => {
        using project = createProject();
        project.write("po/LINGUAS", "fr\n");

        await extract(project.root);
        await extract(project.root);

        expect(po.parse(readFileSync(join(project.root, "po/fr.po"))).headers.Language).toBe("fr");
    });

    it("leaves catalogs untouched when only their template creation date differs", async () => {
        using project = createProject();
        project.write("po/LINGUAS", "fr\n");
        project.write("src/messages.ts", `${T_IMPORT}\nt("Source text");`);

        await extract(project.root);

        const path = join(project.root, "po/fr.po");
        const previous = readFileSync(path, "utf8").replace(
            /^"POT-Creation-Date: .*\\n"$/m,
            '"POT-Creation-Date: 2000-01-01 00:00+0000\\n"',
        );
        project.write("po/fr.po", previous);
        const timestamp = new Date("2000-01-01T00:00:00Z");
        utimesSync(path, timestamp, timestamp);

        await extract(project.root);

        expect(readFileSync(path, "utf8")).toBe(previous);
        expect(statSync(path).mtimeMs).toBe(timestamp.getTime());
    });

    it("preserves the rejection of angle-bracket type assertions", async () => {
        using project = createProject();
        project.write("po/LINGUAS", "");
        project.write("src/messages.ts", `${T_IMPORT}\nt(<string>"key");`);

        await expect(extract(project.root)).rejects.toThrow();
    });
});

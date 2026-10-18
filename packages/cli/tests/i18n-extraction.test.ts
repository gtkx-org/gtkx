import { runCommand } from "citty";
import { po } from "gettext-parser";
import { readFileSync } from "node:fs";
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

    it("preserves the rejection of angle-bracket type assertions", async () => {
        using project = createProject();
        project.write("po/LINGUAS", "");
        project.write("src/messages.ts", `${T_IMPORT}\nt(<string>"key");`);

        await expect(extract(project.root)).rejects.toThrow();
    });
});

import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { createCliProject, runCli } from "./cli-project.js";
import {
    installConfiguredProps,
    OUTPUT,
    PROPS_MODULE,
    readButton,
    runDocs,
    UNION_MODULE,
    writePropsConfig,
} from "./configured-props-fixture.js";

const INVALID_DECLARATION = 'import type * as Gtk from "@gtkx/gi/gtk";\n' +
    "export interface AliasProps { auditWidget: Gtk.Absent; }\n";
const INVALID_PROPS = [
    { title: "an uninstalled package", module: "@audit/not-installed", exported: "Props" },
    { title: "a missing export", module: PROPS_MODULE, exported: "MissingProps" },
    { title: "a value-only export", module: PROPS_MODULE, exported: "ValueProps" },
    { title: "a function export", module: PROPS_MODULE, exported: "FunctionProps" },
];

describe("configured element prop reference", () => {
    it("rejects an invalid union branch and recovers without replacing valid pages", () => {
        using project = createCliProject({ prefix: "gtkx-props-union-invalid-" });
        installConfiguredProps(project.root);
        writePropsConfig(project.root, "UnionProps", UNION_MODULE);
        runDocs(project);
        const before = readButton(project.root);
        const declaration = join(project.nodeModules, UNION_MODULE, "index.d.ts");
        const source = readFileSync(declaration, "utf8");
        writeFileSync(declaration, source.replace("auditFlag: boolean", "auditFlag: Gtk.Absent"));
        expect(runCli(project, ["docs", "--out", OUTPUT]).status).not.toBe(0);
        expect(readButton(project.root)).toBe(before);
        writeFileSync(declaration, source.replaceAll("auditFlag", "auditUpdated"));
        runDocs(project);
        expect(readButton(project.root)).toContain("### `auditUpdated`");
        expect(readButton(project.root)).not.toContain("### `auditFlag`");
    });

    it.each(INVALID_PROPS)("rejects $title without replacing prior pages", ({ module, exported }) => {
        using project = createCliProject({ prefix: "gtkx-props-invalid-" });
        installConfiguredProps(project.root);
        writePropsConfig(project.root);
        runDocs(project);
        const before = readButton(project.root);
        writePropsConfig(project.root, exported, module);
        expect(runCli(project, ["docs", "--out", OUTPUT]).status).not.toBe(0);
        expect(readButton(project.root)).toBe(before);
    });

    it("rejects an absent GIR type without replacing prior pages", () => {
        using project = createCliProject({ prefix: "gtkx-props-invalid-type-" });
        installConfiguredProps(project.root);
        writePropsConfig(project.root);
        runDocs(project);
        const before = readButton(project.root);
        writeFileSync(join(project.nodeModules, PROPS_MODULE, "index.d.ts"), INVALID_DECLARATION);
        expect(runCli(project, ["docs", "--out", OUTPUT]).status).not.toBe(0);
        expect(readButton(project.root)).toBe(before);
    });
});

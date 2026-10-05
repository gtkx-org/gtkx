import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { createCliProject, runCli } from "./cli-project.js";
import {
    installConfiguredProps,
    OUTPUT,
    readButton,
    runDocs,
    UNION_MODULE,
    writePropsConfig,
} from "./configured-props-fixture.js";

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
});

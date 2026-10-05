import { mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { createCliProject, runCli, runCliOrThrow } from "./cli-project.js";
import {
    documentedType,
    OUTPUT,
    readButton,
    runDocs,
} from "./configured-props-fixture.js";

describe("configured element prop reference", () => {
    it("follows current GIR inputs after generating a store and preserves declaration errors", () => {
        using project = createCliProject({ prefix: "gtkx-props-generated-store-" });
        const earlier = join(project.root, "earlier");
        const later = join(project.root, "later");
        const moduleName = "@audit/gir-props";
        const moduleRoot = join(project.nodeModules, moduleName);
        mkdirSync(earlier);
        mkdirSync(later);
        mkdirSync(moduleRoot, { recursive: true });
        const gir = readFileSync(new URL("fixtures/gir/ReferenceProps-1.0.gir", import.meta.url), "utf8");
        const filename = "ReferenceProps-1.0.gir";
        writeFileSync(join(later, filename), gir);
        writeFileSync(join(moduleRoot, "package.json"), JSON.stringify({
            name: moduleName,
            version: "1.0.0",
            type: "module",
            exports: { ".": { types: "./index.d.ts" } },
        }));
        const declaration = 'import type * as ReferenceProps from "@gtkx/gi/referenceprops";\n' +
            'export interface Props { auditValue: ReturnType<ReferenceProps.Probe["getValue"]>; }\n';
        const declarationPath = join(moduleRoot, "index.d.ts");
        writeFileSync(declarationPath, declaration);
        const config = {
            applicationId: "org.gtkx.referenceprops",
            libraries: ["ReferenceProps-1.0"],
            girPath: [earlier, later],
            agents: { rules: false, reference: false },
            elements: { config: { GtkButton: { props: { module: moduleName, export: "Props" } } } },
        };
        writeFileSync(join(project.root, "gtkx.config.mjs"), `export default ${JSON.stringify(config)};\n`);
        runCliOrThrow(project, ["codegen"]);
        runDocs(project);
        expect(documentedType(readButton(project.root), "auditValue")).toBe("string");
        const selected = join(earlier, filename);
        writeFileSync(selected, gir.replace('<type name="utf8" c:type="const gchar*"/>',
            '<type name="gint" c:type="gint"/>'));
        runDocs(project);
        expect(documentedType(readButton(project.root), "auditValue")).toBe("number");
        rmSync(selected);
        runDocs(project);
        expect(documentedType(readButton(project.root), "auditValue")).toBe("string");
        const before = readButton(project.root);
        writeFileSync(declarationPath, declaration.replace('Probe["getValue"]', 'Probe["absent"]'));
        expect(runCli(project, ["docs", "--out", OUTPUT]).status).not.toBe(0);
        expect(readButton(project.root)).toBe(before);
    });
});

import { execFileSync } from "node:child_process";
import { mkdirSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { type CliProject, createCliProject, runCliOrThrow } from "./cli-project.js";

const constantGir = (value: number, version = "1.0"): string => `<?xml version="1.0"?>
<repository version="1.2"
  xmlns="http://www.gtk.org/introspection/core/1.0"
  xmlns:c="http://www.gtk.org/introspection/c/1.0">
  <namespace name="SearchOrder" version="${version}">
    <constant name="VALUE" value="${String(value)}" c:type="SEARCH_ORDER_VALUE">
      <type name="gint" c:type="gint"/>
    </constant>
  </namespace>
</repository>
`;

const dependentGir = (name: string, version: string): string => `<?xml version="1.0"?>
<repository version="1.2" xmlns="http://www.gtk.org/introspection/core/1.0">
  <include name="SearchOrder" version="${version}"/>
  <namespace name="${name}" version="1.0">
    <constant name="PRESENT" value="1"><type name="gint"/></constant>
  </namespace>
</repository>
`;

const configure = (project: CliProject, girPath: string[], libraries = ["SearchOrder-1.0"]): void => {
    const config = {
        applicationId: "com.gtkx.freshness",
        agents: { reference: false },
        libraries,
        girPath,
    };
    writeFileSync(join(project.root, "gtkx.config.ts"), `export default ${JSON.stringify(config)};\n`);
};

const writeGir = (directory: string, identifier: string, source: string): void => {
    mkdirSync(directory, { recursive: true });
    writeFileSync(join(directory, `${identifier}.gir`), source);
};

const importValue = (project: CliProject): number => Number(execFileSync(process.execPath, [
    "--no-addons", "--input-type=module", "--eval",
    'import { VALUE } from "@gtkx/gi/searchorder"; process.stdout.write(String(VALUE));',
], { cwd: project.root, encoding: "utf8" }));

describe("gtkx codegen GIR freshness", () => {
    it("follows search-directory precedence after reordering", () => {
        using project = createCliProject({ prefix: "gtkx-cli-gir-path-order-" });
        const first = join(project.root, "first");
        const second = join(project.root, "second");
        writeGir(first, "SearchOrder-1.0", constantGir(101));
        writeGir(second, "SearchOrder-1.0", constantGir(202));
        configure(project, [first, second]);
        runCliOrThrow(project, ["codegen"]);
        expect(importValue(project)).toBe(101);

        configure(project, [second, first]);
        runCliOrThrow(project, ["codegen"]);
        expect(importValue(project)).toBe(202);
    });

    it.each(["direct", "transitive"])("adopts a new earlier %s GIR", (kind) => {
        using project = createCliProject({ prefix: "gtkx-cli-gir-earlier-copy-" });
        const first = join(project.root, "first");
        const second = join(project.root, "second");
        writeGir(second, "SearchOrder-1.0", constantGir(202));
        writeGir(second, "Root-1.0", dependentGir("Root", "1.0"));
        configure(project, [first, second], kind === "direct" ? ["SearchOrder-1.0"] : ["Root-1.0"]);
        runCliOrThrow(project, ["codegen"]);
        expect(importValue(project)).toBe(202);

        writeGir(first, "SearchOrder-1.0", constantGir(303));
        runCliOrThrow(project, ["codegen"]);
        expect(importValue(project)).toBe(303);
    });

    it("falls back to the next GIR when the selected copy disappears", () => {
        using project = createCliProject({ prefix: "gtkx-cli-gir-removed-copy-" });
        const first = join(project.root, "first");
        const second = join(project.root, "second");
        writeGir(first, "SearchOrder-1.0", constantGir(101));
        writeGir(second, "SearchOrder-1.0", constantGir(202));
        configure(project, [first, second]);
        runCliOrThrow(project, ["codegen"]);
        expect(importValue(project)).toBe(101);

        rmSync(join(first, "SearchOrder-1.0.gir"));
        runCliOrThrow(project, ["codegen"]);
        expect(importValue(project)).toBe(202);
    });

    it("keeps the previous binding usable when its GIR can no longer be found", () => {
        using project = createCliProject({ prefix: "gtkx-cli-gir-missing-" });
        const directory = join(project.root, "gir");
        writeGir(directory, "SearchOrder-1.0", constantGir(101));
        configure(project, [directory]);
        runCliOrThrow(project, ["codegen"]);
        expect(importValue(project)).toBe(101);

        rmSync(join(directory, "SearchOrder-1.0.gir"));
        expect(() => runCliOrThrow(project, ["codegen"])).toThrow();
        expect(importValue(project)).toBe(101);
    });

    it("preserves the first selected version when duplicate roots are supplied", () => {
        using project = createCliProject({ prefix: "gtkx-cli-gir-root-order-" });
        const directory = join(project.root, "gir");
        writeGir(directory, "SearchOrder-1.0", constantGir(101));
        writeGir(directory, "SearchOrder-2.0", constantGir(202, "2.0"));
        configure(project, [directory], ["SearchOrder-1.0", "SearchOrder-1.0", "SearchOrder-2.0"]);
        runCliOrThrow(project, ["codegen"]);
        expect(importValue(project)).toBe(101);

        configure(project, [directory], ["SearchOrder-2.0", "SearchOrder-2.0", "SearchOrder-1.0"]);
        runCliOrThrow(project, ["codegen"]);
        expect(importValue(project)).toBe(202);
    });

    it("follows root traversal order for shared dependency versions", () => {
        using project = createCliProject({ prefix: "gtkx-cli-gir-dependency-order-" });
        const directory = join(project.root, "gir");
        writeGir(directory, "SearchOrder-1.0", constantGir(101));
        writeGir(directory, "SearchOrder-2.0", constantGir(202, "2.0"));
        writeGir(directory, "First-1.0", dependentGir("First", "1.0"));
        writeGir(directory, "Second-1.0", dependentGir("Second", "2.0"));
        configure(project, [directory], ["First-1.0", "Second-1.0"]);
        runCliOrThrow(project, ["codegen"]);
        expect(importValue(project)).toBe(101);

        configure(project, [directory], ["Second-1.0", "First-1.0"]);
        runCliOrThrow(project, ["codegen"]);
        expect(importValue(project)).toBe(202);
    });

    it("resolves newly shadowing GIR files through a search-directory alias", () => {
        using project = createCliProject({ prefix: "gtkx-cli-gir-path-alias-" });
        const first = join(project.root, "first");
        const alias = join(project.root, "alias");
        const second = join(project.root, "second");
        mkdirSync(first);
        symlinkSync(first, alias, "dir");
        writeGir(second, "SearchOrder-1.0", constantGir(202));
        configure(project, [alias, first, second]);
        runCliOrThrow(project, ["codegen"]);
        expect(importValue(project)).toBe(202);

        writeGir(first, "SearchOrder-1.0", constantGir(303));
        runCliOrThrow(project, ["codegen"]);
        expect(importValue(project)).toBe(303);
    });
});

import { mkdirSync, rmSync, symlinkSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { createCliProject, runCliOrThrow } from "./cli-project.js";
import { configure, constantGir, dependentGir, importValue, writeGir } from "./codegen-freshness-fixture.js";

describe("gtkx codegen GIR freshness", () => {
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

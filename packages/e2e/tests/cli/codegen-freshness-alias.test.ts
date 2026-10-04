import { mkdirSync, symlinkSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { createCliProject, runCliOrThrow } from "./cli-project.js";
import { configure, constantGir, importValue, writeGir } from "./codegen-freshness-fixture.js";

describe("gtkx codegen GIR freshness", () => {
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

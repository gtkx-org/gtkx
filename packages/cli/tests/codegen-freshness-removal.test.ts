import { rmSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { createCliProject, runCliOrThrow } from "./cli-project.js";
import { configure, constantGir, importValue, writeGir } from "./codegen-freshness-fixture.js";

describe("gtkx codegen GIR freshness", () => {
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
});

import { rmSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { createCliProject, runCliOrThrow } from "./cli-project.js";
import { configure, constantGir, importValue, writeGir } from "./codegen-freshness-fixture.js";

describe("gtkx codegen GIR freshness", () => {
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
});

import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { createCliProject, runCliOrThrow } from "./cli-project.js";
import { configure, constantGir, importValue, writeGir } from "./codegen-freshness-fixture.js";

describe("gtkx codegen GIR freshness", () => {
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
});

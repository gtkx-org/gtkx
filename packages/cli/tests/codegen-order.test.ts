import { rmSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { createCliProject, runCliOrThrow } from "./cli-project.js";
import { configure, constantGir, dependentGir, importValue, writeGir } from "./codegen-freshness-fixture.js";

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
});

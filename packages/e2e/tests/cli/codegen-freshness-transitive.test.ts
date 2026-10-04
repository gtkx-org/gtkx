import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { createCliProject, runCliOrThrow } from "./cli-project.js";
import { configure, constantGir, dependentGir, importValue, writeGir } from "./codegen-freshness-fixture.js";

describe("gtkx codegen GIR freshness", () => {
    it("adopts a new earlier transitive GIR", () => {
        using project = createCliProject({ prefix: "gtkx-cli-gir-earlier-copy-" });
        const first = join(project.root, "first");
        const second = join(project.root, "second");
        writeGir(second, "SearchOrder-1.0", constantGir(202));
        writeGir(second, "Root-1.0", dependentGir("Root", "1.0"));
        configure(project, [first, second], ["Root-1.0"]);
        runCliOrThrow(project, ["codegen"]);
        expect(importValue(project)).toBe(202);

        writeGir(first, "SearchOrder-1.0", constantGir(303));
        runCliOrThrow(project, ["codegen"]);
        expect(importValue(project)).toBe(303);
    });
});

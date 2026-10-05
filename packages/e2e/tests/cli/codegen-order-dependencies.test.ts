import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { createCliProject, runCliOrThrow } from "./cli-project.js";
import {
    configure,
    constantGir,
    dependentGir,
    importValue,
    writeGir,
} from "./codegen-freshness-fixture.js";

describe("gtkx codegen GIR freshness", () => {
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

import { describe, expect, it } from "vitest";
import { createCliProject, runCliOrThrow } from "./cli-project.js";
import {
    installConfiguredProps,
    readButton,
    runDocs,
    stamp,
    typecheckConsumer,
    UNION_MODULE,
    unionConsumer,
    writePropsConfig,
} from "./configured-props-fixture.js";

describe("configured element prop reference", () => {
    it("documents and emits discriminated unions with inherited and overlapping indexed props", () => {
        using project = createCliProject({ prefix: "gtkx-props-union-" });
        installConfiguredProps(project.root);
        writePropsConfig(project.root, "UnionProps", UNION_MODULE);
        runDocs(project);
        const page = readButton(project.root);

        for (const name of ["auditCount", "auditFlag", "auditLabel"]) {
            expect(page).toContain("### `" + name + "`");
        }

        const before = stamp(project.root);
        runDocs(project);
        expect(stamp(project.root)).toBe(before);
        runCliOrThrow(project, ["codegen"]);
        expect(readButton(project.root, ".gtkx/reference")).toContain("### `auditLabel`");
        typecheckConsumer(project, unionConsumer(project, page));
    });
});

import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { CliProject } from "./cli-project.js";
import {
    createUnknownArraysProject,
    type RejectedName,
} from "./codegen-unknown-arrays-fixture.js";
import { typecheckFile } from "./type-consumer.js";

const REJECTED_NAMES = [
    "fixed-pointer-construction",
    "aliased-pointer-construction",
    "fixed-pointer-full-transfer",
    "aliased-pointer-full-transfer",
    "direct-input",
    "aliased-output",
    "nested-return",
    "skipped-return",
    "namespace-return",
] as const satisfies readonly RejectedName[];

describe("generated unknown-length array callable omissions", () => {
    const cleanup = new DisposableStack();
    let project: CliProject;

    beforeAll(() => {
        project = cleanup.use(createUnknownArraysProject(
            "gtkx-cli-unknown-array-callables-",
            {},
            REJECTED_NAMES,
        ));
    });

    afterAll(() => {
        cleanup.dispose();
    });

    it.each(REJECTED_NAMES)("rejects the omitted public contract in %s", (name) => {
        expect(typecheckFile(project, name + ".tsx")).not.toBe(0);
    });
});

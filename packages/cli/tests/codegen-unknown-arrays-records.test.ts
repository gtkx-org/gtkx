import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { CliProject } from "./cli-project.js";
import {
    createUnknownArraysProject,
    type RejectedName,
} from "./codegen-unknown-arrays-fixture.js";
import { typecheckFile } from "./type-consumer.js";

const REJECTED_NAMES = [
    "property-only-options",
    "property-only-variable",
    "property-only-props",
    "record-read",
    "record-nested",
    "record-constructor",
    "record-constructor-props",
    "record-only-constructor",
    "record-only-variable",
    "record-only-props",
] as const satisfies readonly RejectedName[];

describe("generated unknown-length array record omissions", () => {
    const cleanup = new DisposableStack();
    let project: CliProject;

    beforeAll(() => {
        project = cleanup.use(createUnknownArraysProject(
            "gtkx-cli-unknown-array-records-",
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

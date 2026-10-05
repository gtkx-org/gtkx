import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { CliProject } from "./cli-project.js";
import {
    createUnknownArraysProject,
    type RejectedName,
} from "./codegen-unknown-arrays-fixture.js";
import { typecheckFile } from "./type-consumer.js";

const REJECTED_NAMES = [
    "unknown-callback",
    "callback-alias",
    "callback-consumer",
    "array-alias",
    "nested-alias",
    "property-read",
    "nested-property",
    "property-jsx",
    "property-notify",
] as const satisfies readonly RejectedName[];

describe("generated unknown-length array alias and property omissions", () => {
    const cleanup = new DisposableStack();
    let project: CliProject;

    beforeAll(() => {
        project = cleanup.use(createUnknownArraysProject(
            "gtkx-cli-unknown-array-aliases-properties-",
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

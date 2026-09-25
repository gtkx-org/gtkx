import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { CliProject } from "./cli-project.js";
import {
    createHiddenCallablesProject,
    type RejectedName,
} from "./codegen-hidden-callables-fixture.js";
import { typecheckFile } from "./type-consumer.js";

const REJECTED_NAMES = [
    "pointer-array",
    "aliased-list",
    "hash-values",
    "hash-keys",
    "nested-leaves",
    "static-factory",
    "namespace-input",
    "namespace-return",
] as const satisfies readonly RejectedName[];

describe("generated raw-pointer container callable omissions", () => {
    const cleanup = new DisposableStack();
    let project: CliProject;

    beforeAll(() => {
        project = cleanup.use(createHiddenCallablesProject(
            "gtkx-cli-hidden-callable-containers-",
            {},
            REJECTED_NAMES,
        ));
    });

    afterAll(() => {
        cleanup.dispose();
    });

    it.each(REJECTED_NAMES)("rejects the omitted public callable in %s", (name) => {
        expect(typecheckFile(project, name + ".tsx")).not.toBe(0);
    });
});

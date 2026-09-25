import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { CliProject } from "./cli-project.js";
import {
    createHiddenCallablesProject,
    type RejectedName,
} from "./codegen-hidden-callables-fixture.js";
import { typecheckFile } from "./type-consumer.js";

const REJECTED_NAMES = [
    "hash-table-static",
    "hash-table-size",
    "hash-table-add",
    "hash-table-contains",
    "hash-table-iterator",
] as const satisfies readonly RejectedName[];

describe("generated raw-pointer hash table callable omissions", () => {
    const cleanup = new DisposableStack();
    let project: CliProject;

    beforeAll(() => {
        project = cleanup.use(createHiddenCallablesProject(
            "gtkx-cli-hidden-callable-hash-tables-",
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

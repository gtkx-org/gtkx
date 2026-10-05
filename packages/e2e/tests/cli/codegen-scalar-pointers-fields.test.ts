import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { CliProject } from "./cli-project.js";
import {
    createScalarPointerProject,
    SCALAR_POINTER_REJECTED_FIELDS,
    scalarPointerRejectedFiles,
} from "./codegen-scalar-pointers-fixture.js";
import { typecheckFile } from "./type-consumer.js";

describe("generated scalar C pointer omissions", () => {
    const cleanup = new DisposableStack();
    let project: CliProject;

    beforeAll(() => {
        project = cleanup.use(createScalarPointerProject(
            "gtkx-cli-scalar-pointer-fields-",
            scalarPointerRejectedFiles(SCALAR_POINTER_REJECTED_FIELDS),
        ));
    });

    afterAll(() => {
        cleanup.dispose();
    });

    it.each(Object.keys(SCALAR_POINTER_REJECTED_FIELDS))("rejects the omitted public contract in %s", (name) => {
        expect(typecheckFile(project, `${name}.tsx`)).not.toBe(0);
    });
});

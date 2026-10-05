import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { CliProject } from "./cli-project.js";
import {
    CALLER_CARRAY_REJECTED,
    callerContainerRejectedFiles,
    createCallerContainerProject,
} from "./codegen-caller-containers-fixture.js";
import { typecheckFile } from "./type-consumer.js";

describe("generated caller-allocated container admission", () => {
    const cleanup = new DisposableStack();
    let project: CliProject;

    beforeAll(() => {
        project = cleanup.use(createCallerContainerProject(
            "gtkx-cli-caller-carrays-",
            callerContainerRejectedFiles(CALLER_CARRAY_REJECTED),
        ));
    });

    afterAll(() => {
        cleanup.dispose();
    });

    it.each(Object.keys(CALLER_CARRAY_REJECTED))("rejects the unrepresentable caller output %s", (name) => {
        expect(typecheckFile(project, `${name}.ts`)).not.toBe(0);
    });
});

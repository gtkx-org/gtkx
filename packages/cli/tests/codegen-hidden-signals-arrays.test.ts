import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { CliProject } from "./cli-project.js";
import {
    createHiddenSignalsProject,
    type RejectedName,
} from "./codegen-hidden-signals-fixture.js";
import { typecheckFile } from "./type-consumer.js";

const REJECTED_NAMES = [
    "fixed-array-emit",
    "application-array-emit",
    "settings-array-emit",
] as const satisfies readonly RejectedName[];

describe("generated unsupported signal array omissions", () => {
    const cleanup = new DisposableStack();
    let project: CliProject;

    beforeAll(() => {
        project = cleanup.use(createHiddenSignalsProject(
            "gtkx-cli-hidden-signal-arrays-",
            {},
            REJECTED_NAMES,
        ));
    });

    afterAll(() => {
        cleanup.dispose();
    });

    it.each(REJECTED_NAMES)("rejects the omitted public signal in %s", (name) => {
        expect(typecheckFile(project, name + ".tsx")).not.toBe(0);
    });
});

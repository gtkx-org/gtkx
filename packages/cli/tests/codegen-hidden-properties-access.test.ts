import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { CliProject } from "./cli-project.js";
import {
    createHiddenPropertiesProject,
    type RejectedName,
} from "./codegen-hidden-properties-fixture.js";
import { typecheckFile } from "./type-consumer.js";

const REJECTED_NAMES = [
    "direct-read",
    "aliased-read",
    "direct-write",
    "inherited-aliased-write",
] as const satisfies readonly RejectedName[];

describe("generated raw-pointer property access omissions", () => {
    const cleanup = new DisposableStack();
    let project: CliProject;

    beforeAll(() => {
        project = cleanup.use(createHiddenPropertiesProject(
            "gtkx-cli-hidden-property-access-",
            {},
            REJECTED_NAMES,
        ));
    });

    afterAll(() => {
        cleanup.dispose();
    });

    it.each(REJECTED_NAMES)("rejects the unsupported property consumer %s", (name) => {
        expect(typecheckFile(project, `${name}.tsx`)).not.toBe(0);
    });
});

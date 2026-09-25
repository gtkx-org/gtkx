import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { CliProject } from "./cli-project.js";
import {
    createHiddenPropertiesProject,
    type RejectedName,
} from "./codegen-hidden-properties-fixture.js";
import { typecheckFile } from "./type-consumer.js";

const REJECTED_NAMES = [
    "direct-constructor",
    "inherited-aliased-constructor",
    "raw-only-constructor",
    "raw-only-options",
    "raw-child-constructor",
] as const satisfies readonly RejectedName[];

describe("generated raw-pointer constructor property omissions", () => {
    const cleanup = new DisposableStack();
    let project: CliProject;

    beforeAll(() => {
        project = cleanup.use(createHiddenPropertiesProject(
            "gtkx-cli-hidden-property-constructors-",
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

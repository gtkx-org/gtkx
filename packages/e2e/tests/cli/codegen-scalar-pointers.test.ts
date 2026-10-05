import { describe, expect, it } from "vitest";
import {
    createScalarPointerProject,
    SCALAR_POINTER_ACCEPTED,
    SCALAR_POINTER_NATIVE_CONSUMER,
} from "./codegen-scalar-pointers-fixture.js";
import { typecheckFile } from "./type-consumer.js";

describe("generated scalar C pointer omissions", () => {
    it("preserves scalar values, directional refs, typed handles and annotated arrays", () => {
        using project = createScalarPointerProject("gtkx-cli-scalar-pointer-types-", {
            "accepted.tsx": SCALAR_POINTER_ACCEPTED,
            "native.ts": SCALAR_POINTER_NATIVE_CONSUMER,
        });

        expect(typecheckFile(project, "accepted.tsx")).toBe(0);
        expect(typecheckFile(project, "native.ts")).toBe(0);
    });
});

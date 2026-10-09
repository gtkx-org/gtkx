import { describe, expect, it } from "vitest";
import {
    createScalarPointerProject,
    SCALAR_POINTER_ACCEPTED,
    SCALAR_POINTER_NATIVE_CONSUMER,
    SCALAR_POINTER_REJECTED,
    scalarPointerRejectedFiles,
} from "./codegen-scalar-pointers-fixture.js";
import { typecheckFiles } from "./type-consumer.js";

describe("generated scalar C pointer omissions", () => {
    it("preserves supported consumers and rejects scalar pointer contracts", () => {
        const rejected = scalarPointerRejectedFiles(SCALAR_POINTER_REJECTED);
        using project = createScalarPointerProject("gtkx-cli-scalar-pointer-types-", {
            "accepted.tsx": SCALAR_POINTER_ACCEPTED,
            "native.ts": SCALAR_POINTER_NATIVE_CONSUMER,
            ...rejected,
        });

        const accepted = ["accepted.tsx", "native.ts"];

        for (const [file, result] of typecheckFiles(project, [...accepted, ...Object.keys(rejected)])) {
            expect({ file, ...result }).toMatchObject({ status: accepted.includes(file) ? 0 : 1 });
        }
    });
});

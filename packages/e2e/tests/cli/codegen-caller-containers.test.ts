import { describe, expect, it } from "vitest";
import { ACCEPTED, callerContainerRejectedFiles, createCallerContainerProject, REJECTED } from "./codegen-caller-containers-fixture.js";
import { typecheckFiles } from "./type-consumer.js";

describe("generated caller-allocated container admission", () => {
    it("preserves supported consumers and rejects caller-allocated container contracts", () => {
        const rejected = callerContainerRejectedFiles(REJECTED);
        using project = createCallerContainerProject("gtkx-cli-caller-containers-accepted-", {
            "accepted.ts": ACCEPTED,
            ...rejected,
        });
        for (const [file, result] of typecheckFiles(project, ["accepted.ts", ...Object.keys(rejected)])) {
            expect({ file, ...result }).toMatchObject({ status: file === "accepted.ts" ? 0 : 1 });
        }
    });
});

import { describe, expect, it } from "vitest";
import { ACCEPTED, createCallerContainerProject } from "./codegen-caller-containers-fixture.js";
import { typecheckFile } from "./type-consumer.js";

describe("generated caller-allocated container admission", () => {
    it("preserves ordinary inputs, fixed buffers, records, Icon serialization and optional TLS queries", () => {
        using project = createCallerContainerProject("gtkx-cli-caller-containers-accepted-", {
            "accepted.ts": ACCEPTED,
        });
        expect(typecheckFile(project, "accepted.ts")).toBe(0);
    });
});

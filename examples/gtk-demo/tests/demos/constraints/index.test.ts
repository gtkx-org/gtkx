import { describe, expect, it } from "vitest";
import { constraintsDemos } from "../../../src/demos/constraints/index.js";

describe("constraintsDemos", () => {
    it("exposes the expected constraints demos", () => {
        expect(constraintsDemos.map((d) => d.id)).toEqual([
            "constraints",
            "constraints-interactive",
            "constraints-vfl",
        ]);
    });
});

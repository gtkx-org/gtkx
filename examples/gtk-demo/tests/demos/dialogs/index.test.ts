import { describe, expect, it } from "vitest";
import { dialogsDemos } from "../../../src/demos/dialogs/index.js";

describe("dialogsDemos", () => {
    it("exposes the expected dialogs demos in declared order", () => {
        expect(dialogsDemos.map((d) => d.id)).toEqual(["dialog", "pickers", "pagesetup", "printing"]);
    });
});

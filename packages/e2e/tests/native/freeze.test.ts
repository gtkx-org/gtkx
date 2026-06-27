import { freeze, unfreeze } from "@gtkx/native";
import { describe, expect, it } from "vitest";

describe("freeze and unfreeze", () => {
    it("can be called without arguments", () => {
        expect(() => {
            freeze();
            unfreeze();
        }).not.toThrow();
    });

    it("supports nested freeze/unfreeze pairs", () => {
        expect(() => {
            freeze();
            freeze();
            unfreeze();
            unfreeze();
        }).not.toThrow();
    });
});

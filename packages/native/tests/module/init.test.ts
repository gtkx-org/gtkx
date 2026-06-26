import { describe, expect, it } from "vitest";
import { callArgs, GTK_LIB } from "./utils.js";

describe("init", () => {
    it("initializes GTK and allows FFI calls", () => {
        const label = callArgs(
            GTK_LIB,
            "gtk_label_new",
            [{ type: { type: "string", ownership: "borrowed" }, value: "Test" }],
            {
                type: "gobject",
                ownership: "borrowed",
            },
        );

        expect(label).toBeDefined();
    });
});

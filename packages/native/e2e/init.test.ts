import { describe, expect, it } from "vitest";
import { callArgs, GTK_LIB } from "./helpers/utils.js";

describe("init", () => {
    it("initializes GTK and allows FFI calls", () => {
        const label = callArgs(
            GTK_LIB,
            "gtk_label_new",
            [{ type: { kind: "string", ownership: "borrowed" }, value: "Test" }],
            {
                kind: "gobject",
                ownership: "borrowed",
            },
        );

        expect(label).toBeDefined();
    });
});

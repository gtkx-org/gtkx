import { describe, expect, it } from "vitest";
import { call } from "../../index.js";
import { GTK_LIB } from "./utils.js";

describe("init", () => {
    it("initializes GTK and allows FFI calls", () => {
        const label = call(
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

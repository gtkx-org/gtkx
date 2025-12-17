import { describe, expect, it } from "vitest";
import { call } from "../index.js";
import { GTK_LIB } from "./utils.js";

describe("start", () => {
    it("starts the GTK application and allows FFI calls", () => {
        const label = call(GTK_LIB, "gtk_label_new", [{ type: { type: "string" }, value: "Test" }], {
            type: "gobject",
        });

        expect(label).toBeDefined();
    });
});

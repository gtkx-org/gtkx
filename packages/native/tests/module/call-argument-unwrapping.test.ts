import { describe, expect, it } from "vitest";
import type { Handle } from "../../index.js";
import { callArgs, createLabel, GOBJECT_BORROWED, STRING, VOID } from "./utils.js";

describe("call argument unwrapping", () => {
    it("forwards a Handle argument to a function expecting an object pointer", () => {
        const label = createLabel("Test") as Handle;

        callArgs(
            "libgtk-4.so.1",
            "gtk_label_set_text",
            [
                { type: GOBJECT_BORROWED, value: label },
                { type: STRING, value: "Updated" },
            ],
            VOID,
        );

        const text = callArgs("libgtk-4.so.1", "gtk_label_get_text", [{ type: GOBJECT_BORROWED, value: label }], {
            kind: "string",
            ownership: "borrowed",
        });

        expect(text).toBe("Updated");
    });
});

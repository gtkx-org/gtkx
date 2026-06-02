import { describe, expect, it } from "vitest";
import { call, type NativeHandle } from "../../index.js";
import { createLabel, GOBJECT_BORROWED, STRING, VOID } from "./utils.js";

describe("call argument unwrapping", () => {
    it("forwards a NativeHandle argument to a function expecting an object pointer", () => {
        const label = createLabel("Test") as NativeHandle;

        call(
            "libgtk-4.so.1",
            "gtk_label_set_text",
            [
                { type: GOBJECT_BORROWED, value: label },
                { type: STRING, value: "Updated" },
            ],
            VOID,
        );

        const text = call("libgtk-4.so.1", "gtk_label_get_text", [{ type: GOBJECT_BORROWED, value: label }], {
            type: "string",
            ownership: "borrowed",
        });

        expect(text).toBe("Updated");
    });
});

import * as GObject from "@gtkx/gi/gobject";
import { describe, expect, it } from "vitest";
import { buildValue } from "../src/gvalue.js";

describe("buildValue", () => {
    it("initializes a Value with the given GType and runs the populate callback", () => {
        const value = buildValue(GObject.TYPE_STRING, (v) => v.setString("hello"));
        expect(value).toBeInstanceOf(GObject.Value);
        expect(value.getString()).toBe("hello");
    });

    it("supports integer-typed values", () => {
        const value = buildValue(GObject.TYPE_INT, (v) => v.setInt(42));
        expect(value.getInt()).toBe(42);
    });
});

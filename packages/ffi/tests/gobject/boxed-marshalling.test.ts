import { t } from "@gtkx/ffi";
import * as Gdk from "@gtkx/gi/gdk";
import { describe, expect, it } from "vitest";
import { inoutBoxedForDescriptor, outBoxedForDescriptor, valueGetBoxed } from "../../src/gvalue.js";

describe("boxed GValue marshalling — caller-allocated out copies, inout shares", () => {
    const rectangleFfi = t.boxed("GdkRectangle", {
        ownership: "borrowed",
        library: "libgtk-4.so.1",
        getTypeFn: "gdk_rectangle_get_type",
    });

    it("inoutBoxedForDescriptor shares the caller's wrapper so an in-place mutation is visible", () => {
        const rect = new Gdk.Rectangle({ width: 1 });
        const value = inoutBoxedForDescriptor(rectangleFfi, rect);
        rect.width = 42;
        const seen = valueGetBoxed(value) as Gdk.Rectangle;
        expect(seen.width).toBe(42);
    });

    it("outBoxedForDescriptor copies the wrapper so a later mutation is not visible", () => {
        const rect = new Gdk.Rectangle({ width: 1 });
        const value = outBoxedForDescriptor(rectangleFfi, rect);
        rect.width = 42;
        const seen = valueGetBoxed(value) as Gdk.Rectangle;
        expect(seen.width).toBe(1);
    });
});

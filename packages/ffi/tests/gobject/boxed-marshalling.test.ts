import { t } from "@gtkx/ffi";
import * as Gdk from "@gtkx/gi/gdk";
import { describe, expect, it } from "vitest";
import { inoutBoxedFromFfi, outBoxedFromFfi, valueGetBoxed } from "../../src/gvalue.js";

describe("boxed GValue marshalling — caller-allocated out copies, inout shares", () => {
    const rectangleFfi = t.boxed("GdkRectangle", {
        ownership: "borrowed",
        library: "libgtk-4.so.1",
        getTypeFn: "gdk_rectangle_get_type",
    });

    it("inoutBoxedFromFfi shares the caller's wrapper so an in-place mutation is visible", () => {
        const rect = new Gdk.Rectangle({ width: 1 });
        const value = inoutBoxedFromFfi(rectangleFfi, rect);
        rect.width = 42;
        const seen = valueGetBoxed(value) as Gdk.Rectangle;
        expect(seen.width).toBe(42);
    });

    it("outBoxedFromFfi copies the wrapper so a later mutation is not visible", () => {
        const rect = new Gdk.Rectangle({ width: 1 });
        const value = outBoxedFromFfi(rectangleFfi, rect);
        rect.width = 42;
        const seen = valueGetBoxed(value) as Gdk.Rectangle;
        expect(seen.width).toBe(1);
    });
});

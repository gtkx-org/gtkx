import { t } from "@gtkx/ffi";
import * as Gdk from "@gtkx/gi/gdk";
import { describe, expect, it } from "vitest";
import { getBoxedValue, inoutValueForBoxedDescriptor, outValueForBoxedDescriptor } from "../../src/value.js";

describe("boxed GValue marshalling — caller-allocated out copies, inout shares", () => {
    const rectangleFfi = t.boxed("GdkRectangle", {
        ownership: "borrowed",
        sharedLibrary: "libgtk-4.so.1",
        getTypeFnName: "gdk_rectangle_get_type",
    });

    it("inoutValueForBoxedDescriptor shares the caller's wrapper so an in-place mutation is visible", () => {
        const rect = new Gdk.Rectangle({ width: 1 });
        const value = inoutValueForBoxedDescriptor(rectangleFfi, rect);
        rect.width = 42;
        const seen = getBoxedValue(value) as Gdk.Rectangle;
        expect(seen.width).toBe(42);
    });

    it("outValueForBoxedDescriptor copies the wrapper so a later mutation is not visible", () => {
        const rect = new Gdk.Rectangle({ width: 1 });
        const value = outValueForBoxedDescriptor(rectangleFfi, rect);
        rect.width = 42;
        const seen = getBoxedValue(value) as Gdk.Rectangle;
        expect(seen.width).toBe(1);
    });
});

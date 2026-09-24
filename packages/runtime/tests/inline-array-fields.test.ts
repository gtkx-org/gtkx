import * as Gdk from "@gtkx/gi/gdk";
import * as GObject from "@gtkx/gi/gobject";
import * as Graphene from "@gtkx/gi/graphene";
import * as Gsk from "@gtkx/gi/gsk";
import * as HarfBuzz from "@gtkx/gi/harfbuzz";
import { TYPE_INT } from "@gtkx/runtime";
import { describe, expect, it } from "vitest";

const AXES = [0.5, 1.5, 2.5, 3.5, 4.5, 5.5, 6.5, 7.5, 8.5, 9.5, 10.5, 11.5];

describe("Gdk.TimeCoord.axes", () => {
    it("reads the inline array in place and round-trips what it is given", () => {
        const coord = new Gdk.TimeCoord({ time: 42 });
        expect(coord.axes).toEqual(Array.from({ length: 12 }, () => 0));
        coord.axes = AXES;
        expect(coord.axes).toEqual(AXES);
        expect(coord.time).toBe(42);
    });

    it.each([
        { axes: [...AXES, 99] },
        { axes: AXES.slice(0, -1) },
    ])("refuses arrays that do not contain 12 axes", ({ axes }) => {
        const coord = new Gdk.TimeCoord({ time: 7 });
        coord.axes = AXES;
        expect(() => {
            coord.axes = axes;
        }).toThrow();
        expect(coord.axes).toEqual(AXES);
        expect(coord.time).toBe(7);
    });

    it("refuses an element that is not a number", () => {
        const coord = new Gdk.TimeCoord();
        expect(() => Reflect.set(coord, "axes", ["zero", ...AXES.slice(1)])).toThrow();
    });
});

describe("Gsk.RoundedRect.corner", () => {
    it("round-trips the corners as instances of the element type", () => {
        const rect = new Gsk.RoundedRect();
        expect(rect.corner).toHaveLength(4);
        expect(rect.corner.map((corner) => corner.width)).toEqual([0, 0, 0, 0]);

        rect.corner = [
            new Graphene.Size({ width: 1, height: 2 }),
            new Graphene.Size({ width: 3, height: 4 }),
            new Graphene.Size({ width: 5, height: 6 }),
            new Graphene.Size({ width: 7, height: 8 }),
        ];

        expect(rect.corner.map((corner) => [corner.width, corner.height])).toEqual([[1, 2], [3, 4], [5, 6], [7, 8]]);
        expect(rect.bounds.size.width).toBe(0);
    });

    it.each([2, 5])("refuses arrays that do not contain four corners", (length) => {
        const rect = new Gsk.RoundedRect();
        const corners = Array.from({ length }, (_, index) =>
            new Graphene.Size({ width: index + 1, height: index + 1 }));
        expect(() => {
            rect.corner = corners;
        }).toThrow();
        expect(rect.corner.map((corner) => corner.width)).toEqual([0, 0, 0, 0]);
    });

    it("refuses a corner that is not a record", () => {
        const rect = new Gsk.RoundedRect();
        const size = new Graphene.Size();
        expect(() => Reflect.set(rect, "corner", [null, size, size, size])).toThrow();
    });
});

describe("GObject.Value.data", () => {
    it("keeps the payload readable and exposes no accessor for the raw union", () => {
        const value = new GObject.Value();
        value.init(TYPE_INT);
        value.setInt(42);
        expect(value.getInt()).toBe(42);
        expect("data" in value).toBe(false);
        value.unset();
    });
});

describe("HarfBuzz.var_int_t.u8", () => {
    it("reads and writes the bytes the union stores inline", () => {
        const value = new HarfBuzz.var_int_t({ u32: 0 });
        expect(value.u8).toEqual(new Uint8Array(4));
        value.u8 = Uint8Array.from([1, 2, 3, 4]);
        expect([...value.u8]).toEqual([1, 2, 3, 4]);
        expect(value.u32).not.toBe(0);
        value.u32 = 0;
        expect(value.u8).toEqual(new Uint8Array(4));
    });
});

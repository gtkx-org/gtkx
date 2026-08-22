import * as Gdk from "@gtkx/gi/gdk";
import * as Graphene from "@gtkx/gi/graphene";
import { alloc, getHandle, read, t, write } from "@gtkx/runtime";
import { describe, expect, it } from "vitest";

describe("t.field", () => {
    it("round-trips a scalar through one binding", () => {
        const handle = alloc(8);
        const first = t.field(t.int32, 0);
        first.write(handle, 42);
        expect(first.read(handle)).toBe(42);
    });

    it("reaches the field at the offset it was bound to", () => {
        const handle = alloc(8);
        const first = t.field(t.int32, 0);
        const second = t.field(t.int32, 4);
        first.write(handle, 7);
        second.write(handle, 9);
        expect(first.read(handle)).toBe(7);
        expect(second.read(handle)).toBe(9);
    });

    it("serves every handle it is given, not the one it was bound beside", () => {
        const bound = t.field(t.int32, 0);
        const first = alloc(4);
        const second = alloc(4);
        bound.write(first, 1);
        bound.write(second, 2);
        expect([bound.read(first), bound.read(second)]).toEqual([1, 2]);
    });

    it("reads a field of a generated record", () => {
        const size = new Graphene.Size({ width: 3, height: 4 });
        expect(t.field(t.float32, 0).read(getHandle(size))).toBe(3);
        expect(t.field(t.float32, 4).read(getHandle(size))).toBe(4);
    });

    it("writes a field a generated record reads back", () => {
        const coord = new Gdk.TimeCoord({ time: 1 });
        t.field(t.uint32, 0).write(getHandle(coord), 99);
        expect(coord.time).toBe(99);
    });
});

describe("t.fieldAt", () => {
    it("walks records stored at a stride through one binding", () => {
        const buffer = alloc(24);
        const x = t.fieldAt(t.float64);

        for (let i = 0; i < 3; i++) {
            x.write(buffer, i * 8, i + 1);
        }

        expect([x.read(buffer, 0), x.read(buffer, 8), x.read(buffer, 16)]).toEqual([1, 2, 3]);
    });

    it("reads the fields of one record at their offsets within it", () => {
        const glyph = alloc(24);
        const index = t.fieldAt(t.uint64);
        const coord = t.fieldAt(t.float64);
        index.write(glyph, 0, 7);
        coord.write(glyph, 8, 1.5);
        coord.write(glyph, 16, 2.5);
        expect([index.read(glyph, 0), coord.read(glyph, 8), coord.read(glyph, 16)]).toEqual([7, 1.5, 2.5]);
    });

    it("decodes what the fixed-offset binding decodes at the same offset", () => {
        const handle = alloc(8);
        t.field(t.int32, 4).write(handle, 5);
        expect(t.fieldAt(t.int32).read(handle, 4)).toBe(5);
    });

    it("refuses a fractional offset", () => {
        const bound = t.fieldAt(t.int32);
        const handle = alloc(8);
        expect(() => bound.read(handle, 1.5)).toThrow();
    });

    it("refuses a negative offset", () => {
        const bound = t.fieldAt(t.int32);
        const handle = alloc(8);
        expect(() => bound.read(handle, -4)).toThrow();
    });

    it("refuses a descriptor that cannot be compiled", () => {
        expect(() => t.fieldAt(t.ref(t.void))).toThrow();
    });

    it("refuses to read through a handle that points at nothing", () => {
        const bound = t.fieldAt(t.int32);
        expect(() => bound.read(alloc(0), 0)).toThrow();
    });
});

describe("t.field beside the unbound read and write", () => {
    it("decodes what read decodes from the same descriptor and offset", () => {
        const handle = alloc(8);
        write(handle, t.float64, 0, 2.5);
        expect(t.field(t.float64, 0).read(handle)).toBe(read(handle, t.float64, 0));
    });

    it("sees what the unbound write left, and leaves what it reads back", () => {
        const handle = alloc(8);
        const bound = t.field(t.uint32, 0);
        write(handle, t.uint32, 0, 11);
        expect(bound.read(handle)).toBe(11);
        bound.write(handle, 22);
        expect(read(handle, t.uint32, 0)).toBe(22);
    });
});

describe("t.field edge cases", () => {
    it("binds an offset of zero", () => {
        const handle = alloc(4);
        const bound = t.field(t.int32, 0);
        bound.write(handle, -1);
        expect(bound.read(handle)).toBe(-1);
    });

    it("decodes an inline field as a handle aliasing its owner", () => {
        const rect = new Graphene.Rect();
        const origin = t.field(t.struct("borrowed", { size: 8, isInline: true }), 0);
        t.field(t.float32, 0).write(origin.read(getHandle(rect)) as ReturnType<typeof getHandle>, 5);
        expect(rect.origin.x).toBe(5);
    });

    it("carries a boxed field's ownership across the binding", () => {
        const handle = alloc(8);
        const bound = t.field(t.string("full"), 0);
        bound.write(handle, "held");
        expect(bound.read(handle)).toBe("held");
    });

    it("reaches an inline field bound at a non-zero offset", () => {
        const rect = new Graphene.Rect();
        const size = t.field(t.struct("borrowed", { size: 8, isInline: true }), 8);
        t.field(t.float32, 0).write(size.read(getHandle(rect)) as ReturnType<typeof getHandle>, 3);
        expect(rect.size.width).toBe(3);
    });

    it("replaces an owned string rather than leaking the one it overwrites", () => {
        const handle = alloc(8);
        const bound = t.field(t.string("full"), 0);
        bound.write(handle, "first");
        bound.write(handle, "second");
        expect(bound.read(handle)).toBe("second");
    });
});

describe("t.field error paths", () => {
    it("refuses a fractional offset", () => {
        expect(() => t.field(t.int32, 1.5)).toThrow();
    });

    it("refuses a negative offset", () => {
        expect(() => t.field(t.int32, -4)).toThrow();
    });

    it("refuses a descriptor that cannot be compiled", () => {
        expect(() => t.field(t.ref(t.void), 0)).toThrow();
    });

    it("refuses a value the field cannot hold", () => {
        const bound = t.field(t.int32, 0);
        const handle = alloc(4);

        expect(() => {
            bound.write(handle, "not a number");
        }).toThrow();
    });

    it("refuses a value outside the field's range", () => {
        const bound = t.field(t.uint8, 0);
        const handle = alloc(4);

        expect(() => {
            bound.write(handle, 999);
        }).toThrow();
    });

    it("refuses to read through a handle that points at nothing", () => {
        const bound = t.field(t.int32, 0);
        expect(() => bound.read(alloc(0))).toThrow();
    });

    it("refuses to write through a handle that points at nothing", () => {
        const bound = t.field(t.int32, 0);

        expect(() => {
            bound.write(alloc(0), 1);
        }).toThrow();
    });

    it("refuses to read an inline field through a handle that points at nothing", () => {
        const bound = t.field(t.struct("borrowed", { size: 8, isInline: true }), 0);
        expect(() => bound.read(alloc(0))).toThrow();
    });
});

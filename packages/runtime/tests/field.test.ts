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

    it("reads an owned string field and clears its slot", () => {
        const handle = alloc(8);
        const bound = t.field(t.string("full"), 0);
        try {
            bound.write(handle, "held");
            expect(bound.read(handle)).toBe("held");
        } finally {
            bound.write(handle, null);
        }
        expect(bound.read(handle)).toBeNull();
    });

    it("reaches an inline field bound at a non-zero offset", () => {
        const rect = new Graphene.Rect();
        const size = t.field(t.struct("borrowed", { size: 8, isInline: true }), 8);
        t.field(t.float32, 0).write(size.read(getHandle(rect)) as ReturnType<typeof getHandle>, 3);
        expect(rect.size.width).toBe(3);
    });

    it("replaces an owned string and clears its slot", () => {
        const handle = alloc(8);
        const bound = t.field(t.string("full"), 0);
        try {
            bound.write(handle, "first");
            bound.write(handle, "second");
            expect(bound.read(handle)).toBe("second");
        } finally {
            bound.write(handle, null);
        }
        expect(bound.read(handle)).toBeNull();
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

        for (const value of ["not a number", null, undefined]) {
            expect(() => {
                bound.write(handle, value);
            }).toThrow();
        }
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

describe("semantic scalar fields", () => {
    it("shares boolean conversions across bound, strided and direct accesses", () => {
        const handle = alloc(12);
        const bound = t.field(t.boolean, 0);
        bound.write(handle, true);
        t.fieldAt(t.boolean).write(handle, 4, false);
        write(handle, t.int32, 8, -7);
        expect(bound.read(handle)).toBe(true);
        expect(read(handle, t.boolean, 4)).toBe(false);
        expect(t.fieldAt(t.boolean).read(handle, 8)).toBe(true);
        expect(() => {
            bound.write(handle, 1);
        }).toThrow();
    });

    it("writes Unicode scalars with the same representation as native functions", () => {
        const handle = alloc(8);
        const upper = t.bind("libglib-2.0.so.0", "g_unichar_toupper", [t.unichar], t.unichar);
        const character = t.field(t.unichar, 0);
        character.write(handle, upper("a"));
        expect(character.read(handle)).toBe("A");
        expect(read(handle, t.uint32, 0)).toBe(65);
        write(handle, t.unichar, 4, "\u{10FFFF}");
        expect(t.fieldAt(t.unichar).read(handle, 4)).toBe("\u{10FFFF}");
        for (const invalid of ["ab", -1, 0xD8_00, 0x11_00_00, true]) {
            expect(() => {
                character.write(handle, invalid);
            }).toThrow();
        }
        write(handle, t.uint32, 0, 0x11_00_00);
        expect(() => character.read(handle)).toThrow();
    });

    it("validates enum membership before changing a native field", () => {
        const handle = alloc(4);
        const enumeration = t.enum("libgtk-4.so.1", "gtk_orientation_get_type", false);
        const bound = t.field(enumeration, 0);
        bound.write(handle, 1);
        expect(read(handle, enumeration, 0)).toBe(1);
        for (const invalid of [-1, 2, 0x1_00_00_00_00, 0.5]) {
            expect(() => {
                bound.write(handle, invalid);
            }).toThrow();
            expect(bound.read(handle)).toBe(1);
        }
        const wrongKind = t.field(t.flags("libgtk-4.so.1", "gtk_orientation_get_type", false), 0);
        expect(() => {
            wrongKind.write(handle, 1);
        }).toThrow();
        const unregistered = t.field(t.enum("", "", true, [-1, 2]), 0);
        unregistered.write(handle, -1);
        expect(unregistered.read(handle)).toBe(-1);
        expect(() => {
            unregistered.write(handle, 0);
        }).toThrow();
    });

    it("checks registered and explicit flags masks including the high bit", () => {
        const handle = alloc(4);
        const flags = t.field(t.flags("libgio-2.0.so.0", "g_file_create_flags_get_type", false), 0);
        flags.write(handle, 3);
        expect(flags.read(handle)).toBe(3);
        expect(() => {
            flags.write(handle, 4);
        }).toThrow();
        const high = t.field(t.flags("", "", false, 0x80_00_00_01), 0);
        high.write(handle, 0x80_00_00_01);
        expect(high.read(handle)).toBe(0x80_00_00_01);
        expect(() => {
            high.write(handle, 2);
        }).toThrow();
    });
});

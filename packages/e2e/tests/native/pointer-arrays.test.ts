import { t } from "@gtkx/runtime";
import { describe, expect, it } from "vitest";

const ptrArrayNew = t.fn("libglib-2.0.so.0", "g_ptr_array_new", { args: [], returns: t.biguint64 });

const ptrArrayAdd = t.fn("libglib-2.0.so.0", "g_ptr_array_add", {
    args: [{ type: t.biguint64 }, { type: t.biguint64 }],
    returns: t.void,
});

const ptrArrayDecode = t.fn("libglib-2.0.so.0", "g_ptr_array_ref", {
    args: [{ type: t.biguint64 }],
    returns: t.ptrArray(t.biguint64, "borrowed"),
});

const ptrArrayRoundTrip = t.fn("libglib-2.0.so.0", "g_ptr_array_ref", {
    args: [{ type: t.ptrArray(t.biguint64, "borrowed") }],
    returns: t.ptrArray(t.biguint64, "borrowed"),
});

const listRoundTrip = t.fn("libglib-2.0.so.0", "g_list_copy", {
    args: [{ type: t.list(t.biguint64, "borrowed") }],
    returns: t.list(t.biguint64, "full"),
});

const listLength = t.fn("libglib-2.0.so.0", "g_list_length", {
    args: [{ type: t.list(t.biguint64, "borrowed") }],
    returns: t.uint32,
});

const listNthData = t.fn("libglib-2.0.so.0", "g_list_nth_data", {
    args: [{ type: t.list(t.biguint64, "borrowed") }, { type: t.uint32 }],
    returns: t.biguint64,
});

describe("containers of raw pointers", () => {
    it("decodes a GPtrArray the callee populated", () => {
        const built = ptrArrayNew();
        ptrArrayAdd(built, 111n);
        ptrArrayAdd(built, 222n);
        expect(ptrArrayDecode(built)).toEqual([111n, 222n]);
    });

    it("round-trips pointers through both container layouts", () => {
        expect(ptrArrayRoundTrip([111n, 222n])).toEqual([111n, 222n]);
        expect(listRoundTrip([111n, 222n, 333n])).toEqual([111n, 222n, 333n]);
        expect(listLength([111n, 222n, 333n])).toBe(3);
        expect(listNthData([111n, 222n, 333n], 1)).toBe(222n);
    });

    it("decodes empty containers", () => {
        expect(ptrArrayDecode(ptrArrayNew())).toEqual([]);
        expect(listRoundTrip([])).toEqual([]);
    });

    it("throws for elements that are not pointer-sized integers", () => {
        expect(() => listLength(["nope"])).toThrow();
        expect(() => listLength([-1n])).toThrow();
        expect(() => ptrArrayRoundTrip([1.5])).toThrow();
    });
});

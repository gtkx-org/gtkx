import * as Regress from "@gtkx/gi/regress";
import { type ExternalObject, getHandle, type Handle, read, t, write } from "@gtkx/runtime";
import { expect, test } from "vitest";
import { didSettle, drainGC } from "./helpers/memory.js";

test("caller-allocated Cairo matrices own independent writable storage", () => {
    const matrix = Regress.testCairoMatrixOutCallerAllocates();
    expect(matrix.transformPoint(2, 3)).toEqual({ x: 2, y: 3 });
    Regress.testCairoMatrixNoneIn(matrix);
    matrix.translate(4, 5);
    expect(matrix.transformPoint(2, 3)).toEqual({ x: 6, y: 8 });
    const other = Regress.testCairoMatrixOutCallerAllocates();
    expect(other.transformPoint(2, 3)).toEqual({ x: 2, y: 3 });
    expect(matrix.transformPoint(2, 3)).toEqual({ x: 6, y: 8 });
});

test("owned Cairo paths preserve copied segments and remain usable after collection", async () => {
    const context = Regress.testCairoContextNoneReturn();
    context.newPath();
    try {
        context.moveTo(1, 2);
        context.lineTo(3, 4);
        const path = Regress.testCairoPathFullReturn();
        context.newPath();
        const transferred = Regress.testCairoPathFullInFullReturn(path);
        expect(transferred).not.toBe(path);
        await drainGC();
        expect(path.toData()).toEqual([
            { type: "moveTo", x: 1, y: 2 },
            { type: "lineTo", x: 3, y: 4 },
        ]);
        expect(transferred.toData()).toEqual(path.toData());
        Regress.testCairoPathNoneIn(path);
        Regress.testCairoPathNoneIn(transferred);
    } finally {
        context.newPath();
    }
});

const path = (ownership: "borrowed" | "full") =>
    t.struct(ownership, {
        sharedLibrary: "libcairo.so.2",
        freeFnName: "cairo_path_destroy",
        copyStrategy: "cairo-path",
    });

const copyBorrowedPath = t.bind("libc.so.6", "memmove", [t.buffer, t.buffer, t.biguint64], path("borrowed"));

test("borrowed Cairo results survive collection of the source owner", async () => {
    const context = Regress.testCairoContextNoneReturn();
    context.newPath();
    try {
        context.moveTo(7, 8);
        context.lineTo(9, 10);
        const { source, count, copied } = (() => {
            const original = getHandle(Regress.testCairoPathFullReturn());
            return {
                source: new WeakRef(original),
                count: read(original, t.int32, 16),
                copied: copyBorrowedPath(original, original, 0n) as ExternalObject<Handle>,
            };
        })();
        expect(await didSettle(() => source.deref() === undefined)).toBe(true);

        expect(read(copied, t.int32, 0)).toBe(0);
        expect(read(copied, t.int32, 16)).toBe(count);
    } finally {
        context.newPath();
    }
});

test("failed Cairo status conversion cleans temporary owners and preserves the source", () => {
    const original = getHandle(Regress.testCairoPathFullReturn());
    write(original, t.int32, 0, 1);
    expect(() => copyBorrowedPath(original, original, 0n)).toThrow("Cairo path copy failed with status 1");
    expect(read(original, t.int32, 0)).toBe(1);
    write(original, t.int32, 0, 0);
    const copied = copyBorrowedPath(original, original, 0n) as ExternalObject<Handle>;
    expect(read(copied, t.int32, 0)).toBe(0);
});

test("full Cairo callback returns survive source collection and expire the callback borrow", async () => {
    const copyList = t.bind(
        "libglib-2.0.so.0",
        "g_list_copy_deep",
        [
            t.list(t.struct()),
            t.callback([t.struct(), t.buffer], path("full"), {
                hasUserData: true,
                userDataIndex: 1,
                scope: "call",
            }),
        ],
        t.list(path("full"), "full"),
    );
    let callbackSource: ExternalObject<Handle> | undefined;
    const { source, count, copied } = (() => {
        const original = getHandle(Regress.testCairoPathFullReturn());
        return {
            source: new WeakRef(original),
            count: read(original, t.int32, 16),
            copied: copyList([original], (source: ExternalObject<Handle>) => {
                callbackSource = source;
                return source;
            }) as ExternalObject<Handle>[],
        };
    })();
    expect(await didSettle(() => source.deref() === undefined)).toBe(true);

    expect(copied).toHaveLength(1);
    for (const result of copied) {
        expect(read(result, t.int32, 0)).toBe(0);
        expect(read(result, t.int32, 16)).toBe(count);
    }
    if (callbackSource === undefined) {
        throw new Error("The native copy callback did not run");
    }
    const expired = callbackSource;
    expect(() => read(expired, t.int32, 0)).toThrow("only until that callback returns");
});

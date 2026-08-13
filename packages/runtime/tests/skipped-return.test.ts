import { t } from "@gtkx/runtime";
import { describe, expect, it } from "vitest";
import { wrapCallback } from "../src/callback.js";

const GLIB = "libglib-2.0.so.0";

const URI_SPLIT_ARGS = [
    { type: t.string("borrowed") },
    { type: t.uint32 },
    { type: t.string("full"), direction: "out" as const },
    { type: t.string("full"), direction: "out" as const },
    { type: t.string("full"), direction: "out" as const },
    { type: t.int32, direction: "out" as const },
    { type: t.string("full"), direction: "out" as const },
    { type: t.string("full"), direction: "out" as const },
    { type: t.string("full"), direction: "out" as const },
];

const uriSplit = (isReturnSkipped: boolean): ((...inputs: unknown[]) => unknown) =>
    t.fn(GLIB, "g_uri_split", {
        args: URI_SPLIT_ARGS,
        returns: t.boolean,
        isReturnSkipped,
        canThrow: true,
    });

const slotImplementation = (isReturnSkipped: boolean, fn: (...args: unknown[]) => unknown): typeof fn =>
    wrapCallback(
        fn,
        {
            argDescriptors: [t.object("borrowed"), t.ref(t.string("full"))],
            returnDescriptor: t.boolean,
            isReturnSkipped,
        },
        "none",
    );

describe("calling a C function whose return value GIR skips", () => {
    it("packs only the out parameters into the result", () => {
        expect(uriSplit(true)("https://example.com/p", 0)).toEqual([
            "https",
            null,
            "example.com",
            -1,
            "/p",
            null,
            null,
        ]);
    });

    it("packs the return value first without the marker, which is the arity the marker corrects", () => {
        expect(uriSplit(false)("https://example.com/p", 0)).toEqual([
            true,
            "https",
            null,
            "example.com",
            -1,
            "/p",
            null,
            null,
        ]);
    });
});

describe("implementing a vtable slot whose return value GIR skips", () => {
    it("reads the implementation's result as the out parameter rather than as the return value", () => {
        const label = { value: null as unknown };
        const returned = slotImplementation(true, () => "scanned")(null, label);
        expect(label.value).toBe("scanned");
        expect(returned).toBeUndefined();
    });

    it("reads the leading element as the return value without the marker", () => {
        const label = { value: null as unknown };
        const returned = slotImplementation(false, () => [true, "scanned"])(null, label);
        expect(label.value).toBe("scanned");
        expect(returned).toBe(true);
    });

    it("drops a return value the implementation hands back anyway", () => {
        const label = { value: null as unknown };
        expect(slotImplementation(true, () => true)(null, label)).toBeUndefined();
    });
});

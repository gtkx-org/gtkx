import { t } from "@gtkx/runtime";
import { describe, expect, it } from "vitest";
import { wrapCallback, wrapCallbackValue } from "../src/callback.js";

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

const SLOT_ARGS = [t.object("borrowed"), t.ref(t.string("full"))];
const NOTICE_ARGS = [t.ref(t.string("full")), t.uint64];

const uriSplit = (isReturnSkipped: boolean): ((...inputs: unknown[]) => unknown) =>
    t.fn(GLIB, "g_uri_split", {
        args: URI_SPLIT_ARGS,
        returns: t.boolean,
        isReturnSkipped,
        canThrow: true,
    });

const strHasPrefix = (isReturnSkipped: boolean): ((...inputs: unknown[]) => unknown) =>
    t.fn(GLIB, "g_str_has_prefix", {
        args: [{ type: t.string("borrowed") }, { type: t.string("borrowed") }],
        returns: t.boolean,
        isReturnSkipped,
    });

const slotImplementation = (isReturnSkipped: boolean, fn: (...args: unknown[]) => unknown): typeof fn =>
    wrapCallback(fn, { argDescriptors: SLOT_ARGS, returnDescriptor: t.boolean, isReturnSkipped }, "none");

const callbackValue = (isReturnSkipped: boolean, fn: (...args: unknown[]) => unknown): unknown =>
    wrapCallbackValue(
        t.callback(NOTICE_ARGS, t.boolean, { isReturnSkipped, hasUserData: true, userDataIndex: 1 }),
        fn,
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

    it("drops the value of a call that has nothing else to return", () => {
        expect(strHasPrefix(true)("gtkx", "gtk")).toBeUndefined();
    });

    it("returns that same value without the marker", () => {
        expect(strHasPrefix(false)("gtkx", "gtk")).toBe(true);
    });
});

describe("implementing a vtable slot whose return value GIR skips", () => {
    it("reads the implementation's result as the out parameter and reports success to C", () => {
        const label = { value: null as unknown };
        expect(slotImplementation(true, () => "scanned")(null, label)).toBe(true);
        expect(label.value).toBe("scanned");
    });

    it("reports success to C for an implementation that returns nothing at all", () => {
        const label = { value: null as unknown };
        const calls: string[] = [];

        const scan = (): void => {
            calls.push("scan");
        };

        expect(slotImplementation(true, scan)(null, label)).toBe(true);
        expect(calls).toEqual(["scan"]);
    });

    it("reads the leading element as the return value without the marker", () => {
        const label = { value: null as unknown };
        expect(slotImplementation(false, () => [true, "scanned"])(null, label)).toBe(true);
        expect(label.value).toBe("scanned");
    });

    it("reports nothing to C without the marker when the implementation returns nothing", () => {
        const label = { value: null as unknown };

        const scan = (): void => {
            label.value = "scanned";
        };

        expect(slotImplementation(false, scan)(null, label)).toBeUndefined();
    });
});

describe("passing a callback whose return value GIR skips", () => {
    it("reads the callback's result as the out parameter and reports success to C", () => {
        const note = { value: null as unknown };
        const callback = callbackValue(true, () => "noticed") as (...args: unknown[]) => unknown;
        expect(callback(note, 0)).toBe(true);
        expect(note.value).toBe("noticed");
    });

    it("reads the leading element as the return value without the marker", () => {
        const note = { value: null as unknown };
        const callback = callbackValue(false, () => [true, "noticed"]) as (...args: unknown[]) => unknown;
        expect(callback(note, 0)).toBe(true);
        expect(note.value).toBe("noticed");
    });
});

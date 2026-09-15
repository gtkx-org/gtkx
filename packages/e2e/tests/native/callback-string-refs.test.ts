import type { Ref } from "@gtkx/native";
import { t } from "@gtkx/runtime";
import { expect, test } from "vitest";
import { fixtureLibrary } from "./helpers/fixture-library.js";
import { drainAfterEachTest } from "./helpers/memory.js";

drainAfterEachTest();

const library = fixtureLibrary("callback-string-refs");
const utf8 = "\u{FEFF}café ♥";

test.each(["borrowed", "full"] as const)("callback string refs preserve %s inout seeds", (ownership) => {
    const descriptor = t.ref(t.string(ownership), true);
    const invoke = t.bind(library, `gtkx_string_ref_${ownership}`, [
        t.string(), t.string(), t.callback([descriptor], t.void, { scope: "call" }),
    ], t.boolean);

    for (const seed of [null, "", utf8]) {
        const seen: unknown[] = [];
        expect(invoke(seed, seed, (ref: Ref) => {
            seen.push(ref.value);
        })).toBe(true);
        expect(seen).toEqual([seed]);
    }
});

test.each(["borrowed", "full"] as const)("callback string refs replace %s inout values", (ownership) => {
    const descriptor = t.ref(t.string(ownership), true);
    const invoke = t.bind(library, `gtkx_string_ref_${ownership}`, [
        t.string(), t.string(), t.callback([descriptor], t.void, { scope: "call" }),
    ], t.boolean);
    const transitions = [
        { seed: utf8, output: "新しい ♥" },
        { seed: null, output: "" },
        { seed: "", output: null },
    ];

    for (const { seed, output } of transitions) {
        const seen: unknown[] = [];
        expect(invoke(seed, output, (ref: Ref) => {
            seen.push(ref.value);
            ref.value = output;
        })).toBe(true);
        expect(seen).toEqual([seed]);
    }
});

test.each(["borrowed", "full"] as const)("callback string out refs start empty with %s transfer", (ownership) => {
    const descriptor = t.ref(t.string(ownership));
    const invoke = t.bind(library, `gtkx_string_ref_${ownership}`, [
        t.string(), t.string(), t.callback([descriptor], t.void, { scope: "call" }),
    ], t.boolean);

    for (const output of [null, "", utf8]) {
        const seen: unknown[] = [];
        expect(invoke(null, output, (ref: Ref) => {
            seen.push(ref.value);
            ref.value = output;
        })).toBe(true);
        expect(seen).toEqual([null]);
    }
});

test.each([false, true])("absent callback string ref slots remain optional (%s)", (inout) => {
    const descriptor = t.ref(t.string(), inout);
    const invoke = t.bind(library, "gtkx_string_ref_absent", [
        t.callback([descriptor], t.void, { scope: "call" }),
    ], t.void);
    const seen: unknown[] = [];

    invoke((ref: Ref) => {
        seen.push(ref.value);
        ref.value = utf8;
    });

    expect(seen).toEqual([null]);
});

test.each(["borrowed", "full"] as const)("callback string refs reject invalid %s outputs", (ownership) => {
    const descriptor = t.ref(t.string(ownership), true);
    const invoke = t.bind(library, `gtkx_string_ref_${ownership}`, [
        t.string(), t.string(), t.callback([descriptor], t.void, { scope: "call" }),
    ], t.boolean);

    for (const output of ["a\0b", 42, {}, new Uint8Array([1])]) {
        expect(() => invoke(utf8, utf8, (ref: Ref) => {
            ref.value = output;
        })).toThrow();
    }
    expect(() => invoke(utf8, utf8, () => {
        throw new Error("callback failure");
    })).toThrow();
});

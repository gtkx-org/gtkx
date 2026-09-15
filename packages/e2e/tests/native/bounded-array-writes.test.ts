import type { ExternalObject, Handle, Ref } from "@gtkx/native";
import { t } from "@gtkx/runtime";
import { expect, test } from "vitest";
import { fixtureLibrary } from "./helpers/fixture-library.js";
import { didSettle, drainAfterEachTest } from "./helpers/memory.js";

drainAfterEachTest();

const library = fixtureLibrary("bounded-array-writes", "gobject-2.0");
const holderDescriptor = t.struct("full", { sharedLibrary: library, freeFnName: "gtkx_bounded_holder_free" });
const borrowedHolder = t.struct();
const recordDescriptor = t.struct("full", {
    sharedLibrary: library, copyFnName: "gtkx_bounded_value_copy", freeFnName: "gtkx_bounded_value_free",
});
const holderFor = (kind: number, length = 2, isAllocated = true): ExternalObject<Handle> =>
    t.bind(library, "gtkx_bounded_holder_new", [t.uint32, t.uint32, t.boolean], holderDescriptor)(
        kind, length, isAllocated,
    ) as ExternalObject<Handle>;
const count = (holder: ExternalObject<Handle>): number =>
    t.bind(library, "gtkx_bounded_holder_count", [borrowedHolder], t.uint32)(holder) as number;
const clear = (holder: ExternalObject<Handle>): void => {
    t.bind(library, "gtkx_bounded_holder_clear", [borrowedHolder], t.void)(holder);
};
const freedValues = (): number => t.bind(library, "gtkx_bounded_freed_values", [], t.uint32)() as number;
const finalizedObjects = (): number => t.bind(library, "gtkx_bounded_finalized_objects", [], t.uint32)() as number;
const strings = (holder: ExternalObject<Handle>): unknown[] => {
    const read = t.bind(library, "gtkx_bounded_holder_string", [borrowedHolder, t.uint32], t.string());

    return Array.from({ length: count(holder) }, (_, index) => read(holder, index));
};
const numbers = (holder: ExternalObject<Handle>): unknown[] => {
    const read = t.bind(library, "gtkx_bounded_holder_value", [borrowedHolder, t.uint32], t.int32);

    return Array.from({ length: count(holder) }, (_, index) => read(holder, index));
};
const stringDescriptor = t.sizedArray(t.string("full"), 1, "full");
const stringCallback = t.callback([t.ref(stringDescriptor, true), t.ref(t.uint32, true)], t.void, { scope: "call" });
const initialStrings = ["\u{FEFF}café", "♥"];

for (const replacement of [["新しい", "", "third"], ["one"], [], null]) {
    test(`sized strings replace the original extent with ${String(replacement?.length ?? "null")}`, () => {
        const holder = holderFor(0);
        const invoke = t.bind(library, "gtkx_bounded_holder_visit", [borrowedHolder, stringCallback], t.void);
        const seen: unknown[] = [];

        invoke(holder, (values: Ref, length: Ref) => {
            seen.push(values.value, length.value);
            length.value = replacement?.length ?? 0;
            values.value = replacement;
        });
        expect(seen).toEqual([initialStrings, 2]);
        expect(strings(holder)).toEqual(replacement ?? []);
        clear(holder);
    });
}

for (const length of [3, 1, 0]) {
    test(`sized records release the original two items when the new length is ${String(length)}`, async () => {
        const before = freedValues();
        const holder = holderFor(2);
        const descriptor = t.sizedArray(recordDescriptor, 1, "full");
        const callback = t.callback([t.ref(descriptor, true), t.ref(t.uint32, true)], t.void, { scope: "call" });
        const invoke = t.bind(library, "gtkx_bounded_holder_visit", [borrowedHolder, callback], t.void);
        const create = t.bind(library, "gtkx_bounded_value_new", [t.int32], recordDescriptor);
        const read = t.bind(library, "gtkx_bounded_value_get", [t.struct()], t.int32);
        const replacements = Array.from({ length }, (_, index) => create(20 + index));
        const seeds: ExternalObject<Handle>[] = [];
        const seen: unknown[] = [];

        invoke(holder, (values: Ref, size: Ref) => {
            seeds.push(...values.value as ExternalObject<Handle>[]);
            seen.push(seeds.map((value) => read(value)));
            size.value = length;
            values.value = replacements;
        });
        expect(seen).toEqual([[3, 7]]);
        expect(numbers(holder)).toEqual(Array.from({ length }, (_, index) => 20 + index));
        expect(freedValues() - before).toBe(2);
        clear(holder);
        expect(freedValues() - before).toBe(2 + length);
        seeds.length = 0;
        replacements.length = 0;
        expect(await didSettle(() => freedValues() - before === 4 + 2 * length)).toBe(true);
    });

    test(`sized object replacement keeps independent references at length ${String(length)}`, async () => {
        const before = finalizedObjects();
        const holder = holderFor(1);
        const descriptor = t.sizedArray(t.object("full"), 1, "full");
        const callback = t.callback([t.ref(descriptor, true), t.ref(t.uint32, true)], t.void, { scope: "call" });
        const invoke = t.bind(library, "gtkx_bounded_holder_visit", [borrowedHolder, callback], t.void);
        const create = t.bind(library, "gtkx_bounded_object_new", [t.int32], t.object("full"));
        const read = t.bind(library, "gtkx_bounded_object_value", [t.object()], t.int32);
        const replacements = Array.from({ length }, (_, index) => create(20 + index));
        const seeds: ExternalObject<Handle>[] = [];
        const seen: unknown[] = [];

        invoke(holder, (values: Ref, size: Ref) => {
            seeds.push(...values.value as ExternalObject<Handle>[]);
            seen.push(seeds.map((value) => read(value)));
            size.value = length;
            values.value = replacements;
        });
        expect(seen).toEqual([[3, 7]]);
        expect(numbers(holder)).toEqual(Array.from({ length }, (_, index) => 20 + index));
        clear(holder);
        expect(finalizedObjects() - before).toBe(0);
        seeds.length = 0;
        replacements.length = 0;
        expect(await didSettle(() => finalizedObjects() - before === 2 + length)).toBe(true);
    });
}

for (const isAllocated of [false, true]) {
    test(`sized inout distinguishes null from allocated empty storage (${String(isAllocated)})`, () => {
        const holder = holderFor(0, 0, isAllocated);
        const descriptor = { ...stringDescriptor, preserveNull: true };
        const callback = t.callback([t.ref(descriptor, true), t.ref(t.uint32, true)], t.void, { scope: "call" });
        const invoke = t.bind(library, "gtkx_bounded_holder_visit", [borrowedHolder, callback], t.void);
        const seen: unknown[] = [];

        invoke(holder, (values: Ref, length: Ref) => {
            seen.push(values.value, length.value);
            values.value = ["created"];
            length.value = 1;
        });
        expect(seen).toEqual([isAllocated ? [] : null, 0]);
        expect(strings(holder)).toEqual(["created"]);
        clear(holder);
    });
}

test("sized output-only arrays initialize null native storage", () => {
    const holder = holderFor(0, 0, false);
    const callback = t.callback([t.ref(stringDescriptor), t.ref(t.uint32)], t.void, { scope: "call" });
    const invoke = t.bind(library, "gtkx_bounded_holder_visit", [borrowedHolder, callback], t.void);
    const seen: unknown[] = [];

    invoke(holder, (values: Ref, length: Ref) => {
        seen.push(values.value, length.value);
        values.value = ["created"];
        length.value = 1;
    });
    expect(seen).toEqual([null, null]);
    expect(strings(holder)).toEqual(["created"]);
    clear(holder);
});

test("sized callback validation preserves the existing array", () => {
    const holder = holderFor(0);
    const invoke = t.bind(library, "gtkx_bounded_holder_visit", [borrowedHolder, stringCallback], t.void);

    expect(() => invoke(holder, (values: Ref) => {
        values.value = {};
    })).toThrow();
    expect(strings(holder)).toEqual(initialStrings);
    clear(holder);
});

test("fixed string fields replace owned storage and reject wrong extents", () => {
    const holder = holderFor(0);
    const field = t.field(t.fixedArray(t.string("full"), 2, "full"), 0);

    field.write(holder, ["new", ""]);
    expect(field.read(holder)).toEqual(["new", ""]);
    for (const invalid of [[], ["one"], {}, ["a\0b", "ok"]]) {
        expect(() => {
            field.write(holder, invalid);
        }).toThrow();
    }
    expect(field.read(holder)).toEqual(["new", ""]);
    field.write(holder, null);
    expect(count(holder)).toBe(0);
});

test("fixed record fields release each displaced item", async () => {
    const before = freedValues();
    const holder = holderFor(2);
    const field = t.field(t.fixedArray(recordDescriptor, 2, "full"), 0);
    const create = t.bind(library, "gtkx_bounded_value_new", [t.int32], recordDescriptor);
    const replacements = [create(20), create(21)];

    field.write(holder, replacements);
    expect(numbers(holder)).toEqual([20, 21]);
    expect(freedValues() - before).toBe(2);
    field.write(holder, null);
    expect(freedValues() - before).toBe(4);
    replacements.length = 0;
    expect(await didSettle(() => freedValues() - before === 6)).toBe(true);
});

test("fixed callback records clear using the original extent", async () => {
    const before = freedValues();
    const holder = holderFor(2);
    const descriptor = t.fixedArray(recordDescriptor, 2, "full");
    const callback = t.callback([t.ref(descriptor, true), t.ref(t.uint32, true)], t.void, { scope: "call" });
    const invoke = t.bind(library, "gtkx_bounded_holder_visit", [borrowedHolder, callback], t.void);
    const seeds: ExternalObject<Handle>[] = [];
    const read = t.bind(library, "gtkx_bounded_value_get", [t.struct()], t.int32);
    const seen: unknown[] = [];

    invoke(holder, (values: Ref, length: Ref) => {
        seeds.push(...values.value as ExternalObject<Handle>[]);
        seen.push(seeds.map((value) => read(value)));
        length.value = 0;
        values.value = null;
    });
    expect(seen).toEqual([[3, 7]]);
    expect(count(holder)).toBe(0);
    expect(freedValues() - before).toBe(2);
    seeds.length = 0;
    expect(await didSettle(() => freedValues() - before === 4)).toBe(true);
});

test("sized owned fields require length context before replacing an allocation", () => {
    const holder = holderFor(2);
    const before = freedValues();
    const field = t.field(t.sizedArray(recordDescriptor, 1, "full"), 0);

    expect(() => {
        field.write(holder, null);
    }).toThrow();
    expect(numbers(holder)).toEqual([3, 7]);
    expect(freedValues() - before).toBe(0);
    clear(holder);
    expect(freedValues() - before).toBe(2);
});

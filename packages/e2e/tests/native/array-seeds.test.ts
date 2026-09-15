import type { ExternalObject, Handle, Ref } from "@gtkx/native";
import { type Descriptor, t } from "@gtkx/runtime";
import { expect, test } from "vitest";
import { fixtureLibrary } from "./helpers/fixture-library.js";
import { didSettle, drainAfterEachTest } from "./helpers/memory.js";

drainAfterEachTest();

const library = fixtureLibrary("array-seeds", "gobject-2.0");
const contents = [3, 7];
const strings = ["\u{FEFF}café", "♥"];
const copyableValue = t.struct("full", {
    sharedLibrary: library, copyFnName: "gtkx_array_value_copy", freeFnName: "gtkx_array_value_free",
});
const boxedValue = t.boxed("GtkxArraySeedValue", {
    ownership: "full", sharedLibrary: library, getTypeFnName: "gtkx_array_value_get_type",
});
const fundamental = t.fundamental(library, "gtkx_array_reference_ref", "gtkx_array_reference_unref", {
    ownership: "full",
});
const layouts = [
    { name: "sized", id: 0, make: (item: Descriptor) => t.sizedArray(item, 1, "full") },
    { name: "fixed", id: 1, make: (item: Descriptor, length: number) => t.fixedArray(item, length, "full") },
    { name: "terminated", id: 2, make: (item: Descriptor) => t.array(item, "array", "full") },
    { name: "GPtrArray", id: 3, make: (item: Descriptor) => t.ptrArray(item, "full") },
    { name: "GArray", id: 4, make: (item: Descriptor) => t.array(item, "garray", "full") },
];
const handleTypes = [
    {
        name: "object", kind: 1, item: t.object("full"), argument: t.object(),
        getter: "gtkx_array_object_get", copied: false,
    },
    {
        name: "record", kind: 2, item: copyableValue, argument: t.struct(),
        getter: "gtkx_array_value_get", copied: true,
    },
    { name: "boxed", kind: 2, item: boxedValue, argument: t.struct(), getter: "gtkx_array_value_get", copied: true },
    {
        name: "fundamental", kind: 3, item: fundamental,
        argument: t.fundamental(library, "gtkx_array_reference_ref", "gtkx_array_reference_unref"),
        getter: "gtkx_array_reference_get", copied: false,
    },
];
const releases = (kind: number): number =>
    t.bind(library, "gtkx_array_seed_releases", [t.uint32], t.uint32)(kind) as number;
const seedCallback = (item: Descriptor): Descriptor =>
    t.callback([t.ref(item, true), t.ref(t.uint32, true)], t.void, { scope: "call" });
const invokeSeed = (descriptor: Descriptor): ReturnType<typeof t.bind> =>
    t.bind(library, "gtkx_array_seed", [t.uint32, t.uint32, t.uint32, seedCallback(descriptor)], t.void);

for (const { name, id, make } of layouts) {
    test(`${name} callback string seeds copy values without consuming native contents`, () => {
        const before = releases(0);
        const invoke = invokeSeed(make(t.string("full"), 2));
        const seen: unknown[] = [];

        expect(() => invoke(id, 0, 2, (ref: Ref, size: Ref) => {
            seen.push(ref.value, size.value);
            throw new Error("callback failure");
        })).toThrow();
        expect(seen).toEqual([strings, 2]);
        expect(releases(0) - before).toBe(2);
    });

    for (const type of handleTypes) {
        test(`${name} callback ${type.name} seeds retain independent native ownership`, async () => {
            const before = releases(type.kind);
            const invoke = invokeSeed(make(type.item, 2));
            const readValue = t.bind(library, type.getter, [type.argument], t.int32);
            const seen: unknown[] = [];
            const retained: ExternalObject<Handle>[] = [];

            expect(() => invoke(id, type.kind, 2, (ref: Ref, size: Ref) => {
                retained.push(...ref.value as ExternalObject<Handle>[]);
                seen.push(retained.map((value) => readValue(value)), size.value);
                throw new Error("callback failure");
            })).toThrow();
            expect(seen).toEqual([contents, 2]);
            expect(releases(type.kind) - before).toBe(type.copied ? 2 : 0);
            retained.length = 0;
            expect(await didSettle(() => releases(type.kind) - before === (type.copied ? 4 : 2))).toBe(true);
        });
    }

    test(`${name} callback seeds preserve null and empty containers`, () => {
        const before = releases(0);

        for (const state of [0, 1]) {
            const descriptor = { ...make(t.string("full"), 0), preserveNull: true };
            const invoke = invokeSeed(descriptor);
            const seen: unknown[] = [];

            expect(() => invoke(id, 0, state, (ref: Ref, size: Ref) => {
                seen.push(ref.value, size.value);
                throw new Error("callback failure");
            })).toThrow();
            expect(seen).toEqual([state === 0 ? null : [], 0]);
        }
        expect(releases(0) - before).toBe(0);
    });
}

test("inline callback record seeds retain copied values independently of the native buffer", async () => {
    const before = releases(2);
    const descriptor = t.fixedArray(copyableValue, 2, "full", { elementSize: 4 });
    const invoke = t.bind(library, "gtkx_array_inline_seed", [seedCallback(descriptor)], t.void);
    const readValue = t.bind(library, "gtkx_array_value_get", [t.struct()], t.int32);
    const seen: unknown[] = [];
    const retained: ExternalObject<Handle>[] = [];

    expect(() => invoke((ref: Ref) => {
        retained.push(...ref.value as ExternalObject<Handle>[]);
        seen.push(retained.map((value) => readValue(value)));
        throw new Error("callback failure");
    })).toThrow();
    expect(seen).toEqual([contents]);
    expect(releases(2) - before).toBe(0);
    retained.length = 0;
    expect(await didSettle(() => releases(2) - before === 2)).toBe(true);
});

test("nested pointer-array field reads retain independent inner objects", async () => {
    const before = releases(1);
    const create = t.bind(library, "gtkx_nested_array_new", [], t.struct());
    const free = t.bind(library, "gtkx_nested_array_free", [t.struct()], t.void);
    const readValue = t.bind(library, "gtkx_array_object_get", [t.object()], t.int32);
    const descriptor = t.array(t.array(t.object("full"), "array", "full"), "array", "full");
    const holder = create() as ExternalObject<Handle>;
    const retained: ExternalObject<Handle>[][] = [];

    try {
        retained.push(...t.field(descriptor, 0).read(holder) as ExternalObject<Handle>[][]);
        expect(retained.map((values) => values.map((value) => readValue(value)))).toEqual([contents]);
    } finally {
        free(holder);
    }
    expect(releases(1) - before).toBe(0);
    retained.length = 0;
    expect(await didSettle(() => releases(1) - before === 2)).toBe(true);
});

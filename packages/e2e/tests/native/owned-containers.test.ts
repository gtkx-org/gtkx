import type { ExternalObject, Handle, Ownership, Ref } from "@gtkx/native";
import { type Descriptor, t } from "@gtkx/runtime";
import { expect, test } from "vitest";
import { fixtureLibrary } from "./helpers/fixture-library.js";
import { didSettle, drainAfterEachTest } from "./helpers/memory.js";

drainAfterEachTest();

const library = fixtureLibrary("owned-containers", "gobject-2.0");
const holderType = t.struct();
type Holder = ExternalObject<Handle>;
const createHolder = t.bind(library, "gtkx_owned_holder_new", [t.uint32, t.uint32, t.uint32], holderType);
const freeHolder = t.bind(library, "gtkx_owned_holder_free", [holderType], t.void);
const clearHolder = t.bind(library, "gtkx_owned_holder_clear", [holderType], t.void);
const releaseAlias = t.bind(library, "gtkx_owned_holder_release_alias", [holderType], t.void);
const count = t.bind(library, "gtkx_owned_holder_count", [holderType, t.boolean], t.uint32);
const readString = t.bind(library, "gtkx_owned_holder_string", [holderType, t.boolean, t.uint32], t.string());
const readNumber = t.bind(library, "gtkx_owned_holder_number", [holderType, t.boolean, t.uint32], t.int32);
const createObject = t.bind(library, "gtkx_owned_object_new", [t.int32], t.object("full"));
const objectValue = t.bind(library, "gtkx_owned_object_value", [t.object()], t.int32);
const finalizedObjects = (): number => t.bind(library, "gtkx_owned_finalized_objects", [], t.uint32)() as number;
const freedRecords = (): number => t.bind(library, "gtkx_owned_freed_records", [], t.uint32)() as number;
const initialStrings = ["\u{FEFF}café", "♥"];
const replacementStrings = ["新しい", ""];
const layouts = [{ name: "GPtrArray", id: 0, make: t.ptrArray }, { name: "GArray", id: 1, make: t.gArray }];
const kinds = [
    { name: "strings", id: 0, item: t.string("full"), initial: initialStrings, replacement: replacementStrings },
    { name: "Objects", id: 1, item: t.object("full"), initial: [3, 7], replacement: [20, 21] },
    { name: "scalars", id: 2, item: t.int32, initial: [3, 7], replacement: [-5, 0, 20] },
];
const withHolder = <T>(layout: number, kind: number, state: number, run: (holder: Holder) => T): T => {
    const holder = createHolder(layout, kind, state) as Holder;

    try {
        return run(holder);
    } finally {
        freeHolder(holder);
    }
};
const nativeValues = (holder: Holder, kind: number, isAlias = false): unknown[] => {
    const length = count(holder, isAlias) as number;
    const read = kind === 0 ? readString : readNumber;

    return Array.from({ length }, (_, index) => read(holder, isAlias, index));
};
const observe = (kind: number, value: unknown, retained: unknown[]): unknown => {
    if (value === null) {
        return null;
    }
    if (!Array.isArray(value)) {
        throw new TypeError("Expected an array result");
    }
    const values: unknown[] = value;
    if (kind !== 1) {
        return values;
    }
    retained.push(...values);

    return values.map((item) => objectValue(item));
};
const replacements = (kind: number, values: readonly unknown[]): unknown[] =>
    kind === 1 ? values.map((value) => createObject(value)) : [...values];
const invokeFor = (descriptor: Descriptor): ReturnType<typeof t.bind> =>
    t.bind(library, "gtkx_owned_holder_visit", [
        holderType, t.callback([t.ref(descriptor, true)], t.void, { scope: "call" }),
    ], t.void);

for (const layout of layouts) {
    const descriptorFor = (item: Descriptor, ownership: Ownership = "full"): Descriptor => ({
        ...layout.make(item, ownership, { elementOwnership: "container" }), preserveNull: true,
    });

    for (const kind of kinds) {
        test(`${layout.name} ${kind.name} returns and fields preserve retained aliases`, async () => {
            const before = finalizedObjects();
            const retained: unknown[] = [];
            const inputs = replacements(kind.id, kind.replacement);
            const descriptor = descriptorFor(kind.item);
            const field = t.field(descriptor, 0);
            const returnOwned = t.bind(library, "gtkx_owned_holder_return", [holderType], descriptor);
            const returnBorrowed = t.bind(
                library, "gtkx_owned_holder_peek", [holderType], descriptorFor(kind.item, "borrowed"),
            );

            try {
                withHolder(layout.id, kind.id, 2, (holder) => {
                    expect(observe(kind.id, returnOwned(holder), retained)).toEqual(kind.initial);
                    expect(observe(kind.id, returnBorrowed(holder), retained)).toEqual(kind.initial);
                    expect(observe(kind.id, field.read(holder), retained)).toEqual(kind.initial);
                    expect(nativeValues(holder, kind.id, true)).toEqual(kind.initial);
                    field.write(holder, inputs);
                    expect(nativeValues(holder, kind.id)).toEqual(kind.replacement);
                    expect(nativeValues(holder, kind.id, true)).toEqual(kind.initial);
                    expect(observe(kind.id, inputs, retained)).toEqual(kind.replacement);
                    field.write(holder, []);
                    expect(field.read(holder)).toEqual([]);
                    field.write(holder, null);
                    expect(field.read(holder)).toBeNull();
                    expect(nativeValues(holder, kind.id, true)).toEqual(kind.initial);
                    releaseAlias(holder);
                    expect(finalizedObjects() - before).toBe(0);
                });
            } finally {
                retained.length = 0;
                inputs.length = 0;
            }
            expect(await didSettle(() => finalizedObjects() - before === (kind.id === 1 ? 4 : 0))).toBe(true);
        });

        test(`${layout.name} ${kind.name} callback seeds and replacement preserve alias contents`, async () => {
            const before = finalizedObjects();
            const retained: unknown[] = [];
            const inputs = replacements(kind.id, kind.replacement);
            const descriptor = descriptorFor(kind.item);
            const invoke = invokeFor(descriptor);
            const seen: unknown[] = [];

            try {
                withHolder(layout.id, kind.id, 2, (holder) => {
                    invoke(holder, (ref: Ref) => {
                        seen.push(observe(kind.id, ref.value, retained));
                        ref.value = inputs;
                    });
                    expect(nativeValues(holder, kind.id)).toEqual(kind.replacement);
                    expect(nativeValues(holder, kind.id, true)).toEqual(kind.initial);
                    invoke(holder, (ref: Ref) => {
                        seen.push(observe(kind.id, ref.value, retained));
                        ref.value = [];
                    });
                    invoke(holder, (ref: Ref) => {
                        seen.push(ref.value);
                        ref.value = null;
                    });
                    expect(seen).toEqual([kind.initial, kind.replacement, []]);
                    expect(t.field(descriptor, 0).read(holder)).toBeNull();
                    expect(nativeValues(holder, kind.id, true)).toEqual(kind.initial);
                    releaseAlias(holder);
                    expect(finalizedObjects() - before).toBe(0);
                });
            } finally {
                retained.length = 0;
                inputs.length = 0;
            }
            expect(await didSettle(() => finalizedObjects() - before === (kind.id === 1 ? 4 : 0))).toBe(true);
        });

        for (const ownership of ["full", "borrowed"] satisfies Ownership[]) {
            test(`${layout.name} ${kind.name} ${ownership} inputs remain owned through native aliases`, async () => {
                const before = finalizedObjects();
                const retained: unknown[] = [];
                const inputs = replacements(kind.id, kind.replacement);
                const install = t.bind(library, "gtkx_owned_holder_install", [
                    holderType, descriptorFor(kind.item, ownership), t.boolean,
                ], t.void);

                try {
                    withHolder(layout.id, kind.id, 0, (holder) => {
                        install(holder, inputs, ownership === "full");
                        expect(nativeValues(holder, kind.id)).toEqual(kind.replacement);
                        clearHolder(holder);
                        expect(nativeValues(holder, kind.id, true)).toEqual(kind.replacement);
                        expect(observe(kind.id, inputs, retained)).toEqual(kind.replacement);
                        releaseAlias(holder);
                        expect(finalizedObjects() - before).toBe(0);
                    });
                } finally {
                    retained.length = 0;
                    inputs.length = 0;
                }
                expect(await didSettle(() => finalizedObjects() - before === (kind.id === 1 ? 2 : 0))).toBe(true);
            });
        }

        test(`${layout.name} ${kind.name} invalid writes leave current and alias values intact`, async () => {
            const before = finalizedObjects();
            const inputs = replacements(kind.id, kind.replacement);
            const descriptor = descriptorFor(kind.item);
            const field = t.field(descriptor, 0);
            const invoke = invokeFor(descriptor);

            try {
                withHolder(layout.id, kind.id, 2, (holder) => {
                    expect(() => {
                        field.write(holder, [...inputs.slice(0, 1), {}]);
                    }).toThrow();
                    expect(() => invoke(holder, (ref: Ref) => {
                        ref.value = {};
                    })).toThrow();
                    expect(nativeValues(holder, kind.id)).toEqual(kind.initial);
                    expect(nativeValues(holder, kind.id, true)).toEqual(kind.initial);
                });
            } finally {
                inputs.length = 0;
            }
            expect(await didSettle(() => finalizedObjects() - before === (kind.id === 1 ? 4 : 0))).toBe(true);
        });
    }

    for (const state of [0, 1]) {
        const label = state === 0 ? "null" : "allocated empty";
        test(`${layout.name} distinguishes ${label} fields and callback seeds`, () => {
            const descriptor = descriptorFor(t.string("full"));
            const field = t.field(descriptor, 0);
            const invoke = invokeFor(descriptor);
            const seen: unknown[] = [];

            withHolder(layout.id, 0, state, (holder) => {
                expect(field.read(holder)).toEqual(state === 0 ? null : []);
                invoke(holder, (ref: Ref) => {
                    seen.push(ref.value);
                    ref.value = replacementStrings;
                });
                expect(seen).toEqual([state === 0 ? null : []]);
                expect(nativeValues(holder, 0)).toEqual(replacementStrings);
                expect(nativeValues(holder, 0, true)).toEqual([]);
            });
        });
    }

    test(`${layout.name} noncopyable resource reads and unsupported encoding reject without changing ownership`, () => {
        const before = freedRecords();
        const record = t.struct("full", { sharedLibrary: library, freeFnName: "gtkx_owned_record_free" });
        const descriptor = descriptorFor(record);
        const field = t.field(descriptor, 0);
        const invoke = invokeFor(descriptor);
        const returnOwned = t.bind(library, "gtkx_owned_holder_return", [holderType], descriptor);

        withHolder(layout.id, 3, 2, (holder) => {
            expect(() => returnOwned(holder)).toThrow();
            expect(() => field.read(holder)).toThrow();
            expect(() => invoke(holder, (ref: Ref) => {
                ref.value = null;
            })).toThrow();
            expect(() => {
                field.write(holder, []);
            }).toThrow();
            expect(nativeValues(holder, 3)).toEqual([3, 7]);
            expect(nativeValues(holder, 3, true)).toEqual([3, 7]);
            field.write(holder, null);
            expect(nativeValues(holder, 3, true)).toEqual([3, 7]);
        });
        expect(freedRecords() - before).toBe(2);
    });
}

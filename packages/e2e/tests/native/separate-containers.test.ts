import type { ExternalObject, Handle, Ref } from "@gtkx/native";
import { type Descriptor, t } from "@gtkx/runtime";
import { expect, test } from "vitest";
import { fixtureLibrary } from "./helpers/fixture-library.js";
import { didSettle, drainAfterEachTest } from "./helpers/memory.js";

drainAfterEachTest();

type NativeValue = ExternalObject<Handle>;

const library = fixtureLibrary("separate-containers", "gobject-2.0");
const record = t.struct("full", {
    sharedLibrary: library,
    copyFnName: "gtkx_separate_value_copy",
    freeFnName: "gtkx_separate_value_free",
});
const types = [
    { name: "strings", kind: 0, item: t.string("full"), argument: t.string() },
    { name: "objects", kind: 1, item: t.object("full"), argument: t.object() },
    { name: "records", kind: 2, item: record, argument: t.struct() },
];
const layouts = [
    { name: "GPtrArray", id: 0, make: (item: Descriptor) => t.ptrArray(item, "full") },
    { name: "GArray", id: 1, make: (item: Descriptor) => t.gArray(item, "full") },
];
const createHolder = t.bind(library, "gtkx_separate_holder_new", [t.uint32, t.uint32, t.uint32], t.struct());
const freeHolder = t.bind(library, "gtkx_separate_holder_free", [t.struct()], t.void);
const holderCount = t.bind(library, "gtkx_separate_holder_count", [t.struct(), t.boolean], t.uint32);
const holderIsNull = t.bind(library, "gtkx_separate_holder_is_null", [t.struct()], t.boolean);
const holderGet = t.bind(library, "gtkx_separate_holder_get", [t.struct(), t.boolean, t.uint32], t.int32);
const holderString = t.bind(library, "gtkx_separate_holder_get_string", [t.struct(), t.uint32], t.string());
const keepObjectAlias = t.bind(library, "gtkx_separate_holder_keep_object_alias", [t.struct()], t.void);
const releases = (kind: number): number =>
    t.bind(library, "gtkx_separate_releases", [t.uint32], t.uint32)(kind) as number;
const initialValues = (kind: number): unknown[] => kind === 0 ? ["\u{FEFF}café", "♥"] : [3, 7];
const inputValues = (kind: number): unknown[] => kind === 0 ? ["eleven", "thirteen", "seventeen"] : [11, 13, 17];
const nativeValues = (holder: NativeValue, kind: number, isAlias = false): unknown[] =>
    Array.from({ length: holderCount(holder, isAlias) as number }, (_, index) =>
        kind === 0 ? holderString(holder, index) : holderGet(holder, isAlias, index));
const withHolder = (layout: number, kind: number, state: number, work: (holder: NativeValue) => void): void => {
    const holder = createHolder(layout, kind, state) as NativeValue;
    try {
        work(holder);
    } finally {
        freeHolder(holder);
    }
};
const visitor = (descriptor: Descriptor, isInout = true): ReturnType<typeof t.bind> =>
    t.bind(library, "gtkx_separate_holder_visit", [
        t.struct(), t.callback([t.ref(descriptor, isInout)], t.void, { scope: "call" }),
    ], t.void);

for (const { name, id, make } of layouts) {
    for (const type of types) {
        for (const route of ["field", "callback"]) {
            test(`${name} separate ${type.name} ${route} replacement releases each owned value`, async () => {
                const before = releases(type.kind);
                const descriptor = { ...make(type.item), preserveNull: true };
                const field = t.field(descriptor, 0);
                const createInput = t.bind(library, "gtkx_separate_input_new", [t.uint32, t.int32], type.item);
                const getInput = t.bind(library, "gtkx_separate_input_get", [t.uint32, type.argument], t.int32);
                const input = inputValues(type.kind).map((value) =>
                    type.kind === 0 ? value : createInput(type.kind, value));
                const retained: unknown[] = [];
                const seen: unknown[] = [];

                try {
                    withHolder(id, type.kind, 2, (holder) => {
                        if (route === "field") {
                            retained.push(...field.read(holder) as unknown[]);
                            seen.push(type.kind === 0
                                ? [...retained]
                                : retained.map((value) => getInput(type.kind, value)));
                            field.write(holder, input);
                        } else {
                            visitor(descriptor)(holder, (ref: Ref) => {
                                retained.push(...ref.value as unknown[]);
                                seen.push(type.kind === 0
                                    ? [...retained]
                                    : retained.map((value) => getInput(type.kind, value)));
                                ref.value = input;
                            });
                        }
                        expect(seen).toEqual([initialValues(type.kind)]);
                        expect(nativeValues(holder, type.kind)).toEqual(inputValues(type.kind));
                        field.write(holder, []);
                        expect(nativeValues(holder, type.kind)).toEqual([]);
                        expect(holderIsNull(holder)).toBe(false);
                        field.write(holder, null);
                        expect(holderIsNull(holder)).toBe(true);
                    });
                } finally {
                    retained.length = 0;
                    input.length = 0;
                }

                if (type.kind === 0) {
                    return;
                }
                const expected = type.kind === 1 ? 5 : 10;
                expect(await didSettle(() => releases(type.kind) - before === expected)).toBe(true);
            });
        }

        test(`${name} separate ${type.name} callback seeds round trip without assignment`, async () => {
            const before = releases(type.kind);
            const descriptor = { ...make(type.item), preserveNull: true };
            const getInput = t.bind(library, "gtkx_separate_input_get", [t.uint32, type.argument], t.int32);
            const retained: unknown[] = [];
            const releaseCounts: number[] = [];

            try {
                for (const state of [0, 1, 2]) {
                    withHolder(id, type.kind, state, (holder) => {
                        const seen: unknown[] = [];
                        visitor(descriptor)(holder, (ref: Ref) => {
                            if (ref.value === null) {
                                seen.push(null);

                                return;
                            }
                            const seed = ref.value as unknown[];
                            retained.push(...seed);
                            seen.push(type.kind === 0 ? [...seed] : seed.map((value) => getInput(type.kind, value)));
                        });
                        const expected = state === 2 ? initialValues(type.kind) : [];
                        expect(seen).toEqual([state === 0 ? null : expected]);
                        expect(nativeValues(holder, type.kind)).toEqual(expected);
                        expect(type.kind === 0 ? [...retained] : retained.map((value) => getInput(type.kind, value)))
                            .toEqual(expected);
                        expect(holderIsNull(holder)).toBe(state === 0);
                        releaseCounts.push(releases(type.kind) - before);
                    });
                }
                releaseCounts.push(releases(type.kind) - before);
            } finally {
                retained.length = 0;
            }

            if (type.kind === 0) {
                return;
            }
            expect(releaseCounts).toEqual(type.kind === 1 ? [0, 0, 0, 0] : [0, 0, 2, 4]);
            expect(await didSettle(() => releases(type.kind) - before === (type.kind === 1 ? 2 : 6))).toBe(true);
        });

        test(`${name} rejected separate ${type.name} writes preserve the native owner`, async () => {
            const before = releases(type.kind);
            const descriptor = make(type.item);
            const field = t.field(descriptor, 0);
            const retained: unknown[] = [];
            const seen: unknown[] = [];
            const createInput = t.bind(library, "gtkx_separate_input_new", [t.uint32, t.int32], type.item);
            const getInput = t.bind(library, "gtkx_separate_input_get", [t.uint32, type.argument], t.int32);
            const input = [type.kind === 0 ? "valid" : createInput(type.kind, 11)];

            try {
                withHolder(id, type.kind, 2, (holder) => {
                    expect(() => {
                        field.write(holder, [...input, false]);
                    }).toThrow();
                    expect(nativeValues(holder, type.kind)).toEqual(initialValues(type.kind));
                    expect(() => visitor(descriptor)(holder, (ref: Ref) => {
                        retained.push(...ref.value as unknown[]);
                        seen.push(type.kind === 0
                            ? [...retained]
                            : retained.map((value) => getInput(type.kind, value)));
                        ref.value = [...input, false];
                    })).toThrow();
                    expect(seen).toEqual([initialValues(type.kind)]);
                    expect(nativeValues(holder, type.kind)).toEqual(initialValues(type.kind));
                });
            } finally {
                retained.length = 0;
                input.length = 0;
            }

            if (type.kind === 0) {
                return;
            }
            const expected = type.kind === 1 ? 3 : 5;
            expect(await didSettle(() => releases(type.kind) - before === expected)).toBe(true);
        });
    }

    test(`${name} aliases with their own Object references retain their original contents`, async () => {
        const before = releases(1);
        const createInput = t.bind(library, "gtkx_separate_input_new", [t.uint32, t.int32], t.object("full"));
        const input = [createInput(1, 11)];

        try {
            withHolder(id, 1, 2, (holder) => {
                keepObjectAlias(holder);
                t.field(make(t.object("full")), 0).write(holder, input);
                expect(nativeValues(holder, 1)).toEqual([11]);
                expect(nativeValues(holder, 1, true)).toEqual([3, 7]);
            });
            expect(releases(1) - before).toBe(2);
        } finally {
            input.length = 0;
        }
        expect(await didSettle(() => releases(1) - before === 3)).toBe(true);
    });

    test(`${name} separate null, empty and out-only slots preserve their public values`, () => {
        const descriptor = { ...make(t.string("full")), preserveNull: true };
        const field = t.field(descriptor, 0);

        for (const state of [0, 1]) {
            withHolder(id, 0, state, (holder) => {
                expect(field.read(holder)).toEqual(state === 0 ? null : []);
                field.write(holder, []);
                expect(holderIsNull(holder)).toBe(false);
                field.write(holder, null);
                expect(holderIsNull(holder)).toBe(true);
                const seen: unknown[] = [];
                visitor(descriptor, false)(holder, (ref: Ref) => {
                    seen.push(ref.value);
                    ref.value = ["out"];
                });
                expect(seen).toEqual([null]);
                expect(nativeValues(holder, 0)).toEqual(["out"]);
            });
        }
    });

    test(`${name} missing Separate release metadata rejects before replacing a native record owner`, () => {
        const before = releases(2);
        const unavailable = t.struct("full", {
            sharedLibrary: library,
            copyFnName: "gtkx_separate_value_copy",
            freeFnName: "gtkx_separate_missing_free",
        });
        const field = t.field(make(unavailable), 0);

        withHolder(id, 2, 2, (holder) => {
            expect(() => {
                field.write(holder, null);
            }).toThrow();
            expect(nativeValues(holder, 2)).toEqual([3, 7]);
        });
        expect(releases(2) - before).toBe(2);
    });
}

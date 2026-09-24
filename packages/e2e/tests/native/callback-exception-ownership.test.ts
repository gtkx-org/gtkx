import type { ExternalObject, Handle } from "@gtkx/native";
import { type Descriptor, t } from "@gtkx/runtime";
import { expect, test } from "vitest";
import { fixtureLibrary } from "./helpers/fixture-library.js";
import { didSettle, drainAfterEachTest } from "./helpers/memory.js";

drainAfterEachTest();

type NativeValue = ExternalObject<Handle>;

const library = fixtureLibrary("separate-containers", "gobject-2.0");
const types = [
    { name: "objects", kind: 1, item: t.object("full"), argument: t.object() },
    {
        name: "free-only records",
        kind: 2,
        item: t.struct("full", { sharedLibrary: library, freeFnName: "gtkx_separate_value_free" }),
        argument: t.struct(),
    },
];
const layouts = [
    { name: "GPtrArray", id: 0, make: (item: Descriptor) => t.ptrArray(item, "full") },
    { name: "GArray", id: 1, make: (item: Descriptor) => t.gArray(item, "full") },
];
const createHolder = t.bind(library, "gtkx_separate_holder_new", [t.uint32, t.uint32, t.uint32], t.struct());
const freeHolder = t.bind(library, "gtkx_separate_holder_free", [t.struct()], t.void);
const holderIsNull = t.bind(library, "gtkx_separate_holder_is_null", [t.struct()], t.boolean);
const released = (kind: number): number =>
    t.bind(library, "gtkx_separate_releases", [t.uint32], t.uint32)(kind) as number;
const withHolder = (layout: number, kind: number, state: number, work: (holder: NativeValue) => void): void => {
    const holder = createHolder(layout, kind, state) as NativeValue;
    try {
        work(holder);
    } finally {
        freeHolder(holder);
    }
};
const takeAfterCallback = (
    descriptor: Descriptor,
    route: string,
): ((holder: NativeValue, callback: () => void) => unknown) => {
    const callback = t.callback([], t.void, { scope: "call" });
    if (route === "return") {
        return t.bind(library, "gtkx_separate_holder_return_after_callback", [t.struct(), callback], descriptor);
    }
    const invoke = t.bind(library, "gtkx_separate_holder_out_after_callback", [
        t.struct(), callback, t.ref(descriptor),
    ], t.void);

    return (holder, visit) => {
        const out: { value: unknown } = { value: null };
        invoke(holder, visit, out);

        return out.value;
    };
};

for (const { name, id, make } of layouts) {
    for (const type of types) {
        const descriptor = { ...make(type.item), preserveNull: true };
        const getValue = t.bind(library, "gtkx_separate_input_get", [t.uint32, type.argument], t.int32);

        for (const route of ["return", "out"]) {
            const invoke = takeAfterCallback(descriptor, route);

            test(`${name} ${type.name} ${route} survives a normal synchronous callback`, async () => {
                const before = released(type.kind);
                const retained: unknown[] = [];
                let entries = 0;

                try {
                    for (const state of [0, 1, 2]) {
                        withHolder(id, type.kind, state, (holder) => {
                            const values = invoke(holder, () => {
                                entries += 1;
                            }) as unknown[] | null;
                            expect(holderIsNull(holder)).toBe(true);
                            if (values !== null) {
                                retained.push(...values);
                            }
                            const actual = values === null ? null : values.map((value) => getValue(type.kind, value));
                            const expected = state === 2 ? [3, 7] : [];
                            expect(actual).toEqual(state === 0 ? null : expected);
                        });
                    }
                    expect(entries).toBe(3);
                    expect(released(type.kind) - before).toBe(0);
                    expect(retained.map((value) => getValue(type.kind, value))).toEqual([3, 7]);
                } finally {
                    retained.length = 0;
                }
                expect(await didSettle(() => released(type.kind) - before === 2)).toBe(true);
            });

            test(`${name} ${type.name} ${route} is cleaned when its synchronous callback throws`, async () => {
                const before = released(type.kind);
                let entries = 0;

                for (const state of [0, 1, 2]) {
                    withHolder(id, type.kind, state, (holder) => {
                        expect(() => invoke(holder, () => {
                            entries += 1;
                            throw new Error("callback failure");
                        })).toThrow();
                        expect(holderIsNull(holder)).toBe(true);
                    });
                }
                expect(entries).toBe(3);
                expect(await didSettle(() => released(type.kind) - before === 2)).toBe(true);
            });
        }

        const visitOwned = t.bind(library, "gtkx_separate_visit_owned", [
            t.uint32, t.uint32, t.callback([descriptor], t.void, { scope: "call" }),
        ], t.void);

        test(`${name} ${type.name} owned callback arguments survive repeated native delivery`, async () => {
            const before = released(type.kind);
            const retained: unknown[] = [];
            const seen: unknown[][] = [];

            try {
                visitOwned(id, type.kind, (values: unknown[]) => {
                    retained.push(...values);
                    seen.push(values.map((value) => getValue(type.kind, value)));
                });
                expect(seen).toEqual([[3, 7], [3, 7]]);
                expect(retained.map((value) => getValue(type.kind, value))).toEqual([3, 7, 3, 7]);
                expect(released(type.kind) - before).toBe(0);
            } finally {
                retained.length = 0;
            }
            expect(await didSettle(() => released(type.kind) - before === 4)).toBe(true);
        });

        test(`${name} ${type.name} later callback arguments are cleaned after the first callback throws`, async () => {
            const before = released(type.kind);
            const retained: unknown[] = [];
            const seen: unknown[][] = [];

            try {
                expect(() => visitOwned(id, type.kind, (values: unknown[]) => {
                    retained.push(...values);
                    seen.push(values.map((value) => getValue(type.kind, value)));
                    throw new Error("callback failure");
                })).toThrow();
                expect(seen).toEqual([[3, 7]]);
                expect(retained.map((value) => getValue(type.kind, value))).toEqual([3, 7]);
            } finally {
                retained.length = 0;
            }
            expect(await didSettle(() => released(type.kind) - before === 4)).toBe(true);
        });

        test(`${name} ${type.name} survives a caught nested callback exception`, async () => {
            const before = released(type.kind);
            const invoke = takeAfterCallback(descriptor, "return");
            const retained: unknown[] = [];
            const entries: string[] = [];

            const fail = (): never => {
                entries.push("inner");
                throw new Error("callback failure");
            };
            const catchInner = (inner: NativeValue): void => {
                entries.push("outer");
                expect(() => invoke(inner, fail)).toThrow();
                entries.push("continued");
            };

            try {
                withHolder(id, type.kind, 2, (outer) => {
                    withHolder(id, type.kind, 2, (inner) => {
                        const values = invoke(outer, () => {
                            catchInner(inner);
                        }) as unknown[];
                        retained.push(...values);
                        expect(holderIsNull(inner)).toBe(true);
                        expect(holderIsNull(outer)).toBe(true);
                    });
                });
                expect(entries).toEqual(["outer", "inner", "continued"]);
                expect(retained.map((value) => getValue(type.kind, value))).toEqual([3, 7]);
            } finally {
                retained.length = 0;
            }
            expect(await didSettle(() => released(type.kind) - before === 4)).toBe(true);
        });
    }
}

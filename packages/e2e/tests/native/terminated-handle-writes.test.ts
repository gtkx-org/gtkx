import type { ExternalObject, Handle, Ref } from "@gtkx/native";
import { type Descriptor, t } from "@gtkx/runtime";
import { expect, test } from "vitest";
import { fixtureLibrary } from "./helpers/fixture-library.js";
import { didSettle, drainAfterEachTest } from "./helpers/memory.js";

drainAfterEachTest();

const library = fixtureLibrary("terminated-handle-writes", "gobject-2.0");
const holderDescriptor = t.struct("full", { sharedLibrary: library, freeFnName: "gtkx_terminated_holder_free" });
const recordDescriptor = t.struct("full", {
    sharedLibrary: library,
    copyFnName: "gtkx_terminated_value_copy",
    freeFnName: "gtkx_terminated_value_free",
});
const referenceDescriptor = t.fundamental(
    library, "gtkx_terminated_reference_ref", "gtkx_terminated_reference_unref", { ownership: "full" },
);
const handleTypes = [
    { name: "object", kind: 0, item: t.object("full"), argument: t.object(), isCopied: false },
    { name: "record", kind: 1, item: recordDescriptor, argument: t.struct(), isCopied: true },
    {
        name: "boxed", kind: 2,
        item: t.boxed("GtkxTerminatedValue", {
            ownership: "full", sharedLibrary: library, getTypeFnName: "gtkx_terminated_value_get_type",
        }),
        argument: t.struct(), isCopied: true,
    },
    {
        name: "fundamental", kind: 3, item: referenceDescriptor,
        argument: t.fundamental(library, "gtkx_terminated_reference_ref", "gtkx_terminated_reference_unref"),
        isCopied: false,
    },
];
const holderFor = (kind: number, state = 2): ExternalObject<Handle> =>
    t.bind(library, "gtkx_terminated_holder_new", [t.uint32, t.uint32], holderDescriptor)(
        kind, state,
    ) as ExternalObject<Handle>;
const count = (holder: ExternalObject<Handle>): number =>
    t.bind(library, "gtkx_terminated_holder_count", [t.struct()], t.uint32)(holder) as number;
const clear = (holder: ExternalObject<Handle>): void => {
    t.bind(library, "gtkx_terminated_holder_clear", [t.struct()], t.void)(holder);
};
const releases = (kind: number): number =>
    t.bind(library, "gtkx_terminated_releases", [t.uint32], t.uint32)(kind) as number;
const nativeValues = (holder: ExternalObject<Handle>): unknown[] => {
    const read = t.bind(library, "gtkx_terminated_holder_value", [t.struct(), t.uint32], t.int32);

    return Array.from({ length: count(holder) }, (_, index) => read(holder, index));
};
const invokeFor = (descriptor: Descriptor, isInout = true): ReturnType<typeof t.bind> => {
    const callback = t.callback([t.ref(descriptor, isInout)], t.void, { scope: "call" });

    return t.bind(library, "gtkx_terminated_holder_visit", [t.struct(), callback], t.void);
};

for (const type of handleTypes) {
    test(`terminated ${type.name} fields release repeated replacements and retain independent reads`, async () => {
        const before = releases(type.kind);
        const holder = holderFor(type.kind);
        const descriptor = t.array(type.item, "array", "full");
        const field = t.field(descriptor, 0);
        const read = t.bind(library, "gtkx_terminated_item_value", [t.uint32, type.argument], t.int32);
        const create = t.bind(library, "gtkx_terminated_item_new", [t.uint32, t.int32], type.item);
        const retained = field.read(holder) as ExternalObject<Handle>[];
        const replacements = [11, 13, 17].map((value) => create(type.kind, value));

        expect(retained.map((value) => read(type.kind, value))).toEqual([3, 7]);
        field.write(holder, replacements);
        expect(nativeValues(holder)).toEqual([11, 13, 17]);
        expect(releases(type.kind) - before).toBe(type.isCopied ? 2 : 0);
        field.write(holder, replacements);
        expect(nativeValues(holder)).toEqual([11, 13, 17]);
        expect(releases(type.kind) - before).toBe(type.isCopied ? 5 : 0);
        field.write(holder, []);
        expect(field.read(holder)).toEqual([]);
        expect(releases(type.kind) - before).toBe(type.isCopied ? 8 : 0);
        field.write(holder, null);
        expect(count(holder)).toBe(0);
        retained.length = 0;
        replacements.length = 0;
        const expected = type.isCopied ? 13 : 5;
        expect(await didSettle(() => releases(type.kind) - before === expected)).toBe(true);
    });

    test(`terminated ${type.name} callback refs preserve seeds while replacing owned storage`, async () => {
        const before = releases(type.kind);
        const holder = holderFor(type.kind);
        const descriptor = t.array(type.item, "array", "full");
        const invoke = invokeFor(descriptor);
        const read = t.bind(library, "gtkx_terminated_item_value", [t.uint32, type.argument], t.int32);
        const create = t.bind(library, "gtkx_terminated_item_new", [t.uint32, t.int32], type.item);
        const replacements = [create(type.kind, 23)];
        const retained: ExternalObject<Handle>[] = [];
        const seen: unknown[] = [];

        invoke(holder, (ref: Ref) => {
            retained.push(...ref.value as ExternalObject<Handle>[]);
            seen.push(retained.map((value) => read(type.kind, value)));
            ref.value = replacements;
        });
        expect(seen).toEqual([[3, 7]]);
        expect(nativeValues(holder)).toEqual([23]);
        expect(releases(type.kind) - before).toBe(type.isCopied ? 2 : 0);
        clear(holder);
        expect(releases(type.kind) - before).toBe(type.isCopied ? 3 : 0);
        retained.length = 0;
        replacements.length = 0;
        const expected = type.isCopied ? 6 : 3;
        expect(await didSettle(() => releases(type.kind) - before === expected)).toBe(true);
    });
}

for (const entry of [
    { name: "null inout", state: 0, isInout: true, expected: null },
    { name: "empty inout", state: 1, isInout: true, expected: [] },
    { name: "null output", state: 0, isInout: false, expected: null },
]) {
    test(`terminated callback refs initialize ${entry.name} storage`, () => {
        const holder = holderFor(0, entry.state);
        const descriptor = { ...t.array(t.object("full"), "array", "full"), preserveNull: true };
        const invoke = invokeFor(descriptor, entry.isInout);
        const create = t.bind(library, "gtkx_terminated_item_new", [t.uint32, t.int32], t.object("full"));
        const replacement = create(0, 29);
        const seen: unknown[] = [];

        invoke(holder, (ref: Ref) => {
            seen.push(ref.value);
            ref.value = [replacement];
        });
        expect(seen).toEqual([entry.expected]);
        expect(nativeValues(holder)).toEqual([29]);
        clear(holder);
    });
}

test("terminated field input validation preserves native ownership", () => {
    const before = releases(1);
    const holder = holderFor(1);
    const field = t.field(t.array(recordDescriptor, "array", "full"), 0);

    expect(() => {
        field.write(holder, {});
    }).toThrow();
    expect(nativeValues(holder)).toEqual([3, 7]);
    expect(releases(1) - before).toBe(0);
    clear(holder);
    expect(releases(1) - before).toBe(2);
});

test("terminated callback input validation preserves native ownership", async () => {
    const before = releases(1);
    const holder = holderFor(1);
    const invoke = invokeFor(t.array(recordDescriptor, "array", "full"));
    const read = t.bind(library, "gtkx_terminated_item_value", [t.uint32, t.struct()], t.int32);
    const retained: ExternalObject<Handle>[] = [];
    const seen: unknown[] = [];

    expect(() => invoke(holder, (ref: Ref) => {
        retained.push(...ref.value as ExternalObject<Handle>[]);
        seen.push(retained.map((value) => read(1, value)));
        ref.value = {};
    })).toThrow();
    expect(seen).toEqual([[3, 7]]);
    expect(nativeValues(holder)).toEqual([3, 7]);
    expect(releases(1) - before).toBe(0);
    clear(holder);
    expect(releases(1) - before).toBe(2);
    retained.length = 0;
    expect(await didSettle(() => releases(1) - before === 4)).toBe(true);
});

test("terminated field cleanup resolution fails before displacing native storage", () => {
    const before = releases(1);
    const holder = holderFor(1);
    const descriptor = t.struct("full", {
        sharedLibrary: library, freeFnName: "gtkx_terminated_missing_free",
    });

    expect(() => {
        t.field(t.array(descriptor, "array", "full"), 0).write(holder, null);
    }).toThrow();
    expect(nativeValues(holder)).toEqual([3, 7]);
    expect(releases(1) - before).toBe(0);
    clear(holder);
    expect(releases(1) - before).toBe(2);
});

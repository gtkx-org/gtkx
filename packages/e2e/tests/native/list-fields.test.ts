import type { ExternalObject, Handle, Ref } from "@gtkx/native";
import { t } from "@gtkx/runtime";
import { expect, test } from "vitest";
import { fixtureLibrary } from "./helpers/fixture-library.js";
import { didSettle, drainAfterEachTest } from "./helpers/memory.js";

drainAfterEachTest();

const library = fixtureLibrary("list-fields", "gobject-2.0");
const layouts = [
    { name: "GList", list: t.list, isSingly: false },
    { name: "GSList", list: t.slist, isSingly: true },
];
const initialStrings = ["\u{FEFF}café", "♥"];
const replacementStrings = ["新しい", ""];
const holderDescriptor = t.struct("full", { sharedLibrary: library, freeFnName: "gtkx_list_holder_free" });
const copyableValue = t.struct("full", {
    sharedLibrary: library, copyFnName: "gtkx_list_value_copy", freeFnName: "gtkx_list_value_free",
});
const noncopyableValues = [
    t.struct("full", { sharedLibrary: library, freeFnName: "gtkx_list_value_free" }),
    t.boxed("GtkxListValue", {
        ownership: "full", sharedLibrary: library, freeFnName: "gtkx_list_value_free",
    }),
];
const borrowedHolder = t.struct();
const holderFor = (isSingly: boolean, kind: number, isPopulated = true): ExternalObject<Handle> =>
    t.bind(library, "gtkx_list_holder_new", [t.boolean, t.uint32, t.boolean], holderDescriptor)(
        isSingly, kind, isPopulated,
    ) as ExternalObject<Handle>;
const count = (holder: ExternalObject<Handle>): unknown =>
    t.bind(library, "gtkx_list_holder_count", [borrowedHolder], t.uint32)(holder);
const finalizedObjects = (): number =>
    t.bind(library, "gtkx_list_finalized_objects", [], t.uint32)() as number;
const freedValues = (): number => t.bind(library, "gtkx_list_freed_values", [], t.uint32)() as number;

for (const { name, list, isSingly } of layouts) {
    test(`${name} string fields copy reads and replace owned contents`, () => {
        const holder = holderFor(isSingly, 0);
        const field = t.field(list(t.string("full"), "full"), 0);
        const nullable = t.field({ ...list(t.string("full"), "full"), preserveNull: true }, 0);

        expect(field.read(holder)).toEqual(initialStrings);
        expect(field.read(holder)).toEqual(initialStrings);
        field.write(holder, replacementStrings);
        expect(field.read(holder)).toEqual(replacementStrings);
        field.write(holder, []);
        expect(field.read(holder)).toEqual([]);
        expect(nullable.read(holder)).toBeNull();
        field.write(holder, initialStrings);
        field.write(holder, null);
        expect(count(holder)).toBe(0);
    });

    test(`${name} field validation preserves the installed list`, () => {
        const holder = holderFor(isSingly, 0);
        const field = t.field(list(t.string("full"), "full"), 0);

        for (const input of [{}, "nope", ["a\0b"], [1]]) {
            expect(() => {
                field.write(holder, input);
            }).toThrow();
        }
        expect(field.read(holder)).toEqual(initialStrings);
    });

    test(`${name} owned object lists release displaced references`, () => {
        const before = finalizedObjects();
        const holder = holderFor(isSingly, 1);
        const field = t.field(list(t.object("full"), "full"), 0);

        field.write(holder, []);
        expect(count(holder)).toBe(0);
        expect(finalizedObjects() - before).toBe(2);
    });

    test(`${name} object field reads retain their own references`, async () => {
        const before = finalizedObjects();
        const holder = holderFor(isSingly, 1);
        const field = t.field(list(t.object("full"), "full"), 0);
        const readValue = t.bind(library, "gtkx_list_object_value", [t.object()], t.int32);
        const values = field.read(holder) as ExternalObject<Handle>[];

        expect(values.map((value) => readValue(value))).toEqual([3, 7]);
        field.write(holder, []);
        expect(finalizedObjects() - before).toBe(0);
        values.length = 0;
        expect(await didSettle(() => finalizedObjects() - before === 2)).toBe(true);
    });

    test(`${name} record field reads use declared copy and free functions`, async () => {
        const before = freedValues();
        const holder = holderFor(isSingly, 2);
        const field = t.field(list(copyableValue, "full"), 0);
        const readValue = t.bind(library, "gtkx_list_value_get", [t.struct()], t.int32);
        const values = field.read(holder) as ExternalObject<Handle>[];

        expect(values.map((value) => readValue(value))).toEqual([3, 7]);
        field.write(holder, []);
        expect(freedValues() - before).toBe(2);
        values.length = 0;
        expect(await didSettle(() => freedValues() - before === 4)).toBe(true);
    });

    test(`${name} noncopyable field items reject reads and retain declared cleanup`, () => {
        for (const descriptor of noncopyableValues) {
            const before = freedValues();
            const holder = holderFor(isSingly, 2);
            const field = t.field(list(descriptor, "full"), 0);

            expect(() => field.read(holder)).toThrow();
            expect(count(holder)).toBe(2);
            field.write(holder, []);
            expect(freedValues() - before).toBe(2);
            expect(field.read(holder)).toEqual([]);
        }
    });

    test(`${name} callback inout strings preserve and replace owned seeds`, () => {
        const descriptor = list(t.string("full"), "full");
        const callback = t.callback([t.ref(descriptor, true)], t.void, { scope: "call" });
        const invoke = t.bind(library, "gtkx_list_holder_visit", [borrowedHolder, callback], t.void);
        const holder = holderFor(isSingly, 0);
        const seen: unknown[] = [];

        invoke(holder, (ref: Ref) => {
            seen.push(ref.value);
        });
        invoke(holder, (ref: Ref) => {
            seen.push(ref.value);
            ref.value = replacementStrings;
        });
        expect(seen).toEqual([initialStrings, initialStrings]);
        expect(t.field(descriptor, 0).read(holder)).toEqual(replacementStrings);
        invoke(holder, (ref: Ref) => {
            ref.value = [];
        });
        expect(count(holder)).toBe(0);
    });

    test(`${name} callback refs preserve empty inout and output-only contracts`, () => {
        const descriptor = { ...list(t.string("full"), "full"), preserveNull: true };
        const field = t.field(descriptor, 0);

        for (const isInout of [false, true]) {
            const callback = t.callback([t.ref(descriptor, isInout)], t.void, { scope: "call" });
            const invoke = t.bind(library, "gtkx_list_holder_visit", [borrowedHolder, callback], t.void);
            const holder = holderFor(isSingly, 0, false);
            const seen: unknown[] = [];

            invoke(holder, (ref: Ref) => {
                seen.push(ref.value);
                ref.value = replacementStrings;
            });
            expect(seen).toEqual([null]);
            expect(field.read(holder)).toEqual(replacementStrings);
        }
    });

    test(`${name} callback object seeds keep independent references during replacement`, async () => {
        const before = finalizedObjects();
        const descriptor = list(t.object("full"), "full");
        const callback = t.callback([t.ref(descriptor, true)], t.void, { scope: "call" });
        const invoke = t.bind(library, "gtkx_list_holder_visit", [borrowedHolder, callback], t.void);
        const readValue = t.bind(library, "gtkx_list_object_value", [t.object()], t.int32);
        const holder = holderFor(isSingly, 1);
        const seen: unknown[] = [];
        const values: ExternalObject<Handle>[] = [];

        invoke(holder, (ref: Ref) => {
            values.push(...ref.value as ExternalObject<Handle>[]);
            seen.push(values.map((value) => readValue(value)));
            ref.value = [];
        });
        expect(seen).toEqual([[3, 7]]);
        expect(finalizedObjects() - before).toBe(0);
        values.length = 0;
        expect(await didSettle(() => finalizedObjects() - before === 2)).toBe(true);
    });

    test(`${name} noncopyable callback seeds reject without consuming the list`, () => {
        for (const item of noncopyableValues) {
            const before = freedValues();
            const descriptor = list(item, "full");
            const callback = t.callback([t.ref(descriptor, true)], t.void, { scope: "call" });
            const invoke = t.bind(library, "gtkx_list_holder_visit", [borrowedHolder, callback], t.void);
            const holder = holderFor(isSingly, 2);

            expect(() => invoke(holder, (ref: Ref) => {
                ref.value = [];
            })).toThrow();
            expect(count(holder)).toBe(2);
            t.field(descriptor, 0).write(holder, []);
            expect(freedValues() - before).toBe(2);
        }
    });

    test(`${name} callback validation preserves the installed list`, () => {
        const descriptor = list(t.string("full"), "full");
        const callback = t.callback([t.ref(descriptor, true)], t.void, { scope: "call" });
        const invoke = t.bind(library, "gtkx_list_holder_visit", [borrowedHolder, callback], t.void);
        const holder = holderFor(isSingly, 0);

        expect(() => invoke(holder, (ref: Ref) => {
            ref.value = {};
        })).toThrow();
        expect(t.field(descriptor, 0).read(holder)).toEqual(initialStrings);
    });
}

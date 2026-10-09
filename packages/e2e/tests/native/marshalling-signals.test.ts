import * as GIMarshallingTests from "@gtkx/gi/gimarshallingtests";
import { describe, expect, test } from "vitest";

const listenerCounts = [0, 1, 3];

describe.each([
    { signal: "some-boxed-gptrarray-utf8", emit: "emitBoxedGptrarrayUtf8" },
    { signal: "some-boxed-gptrarray-utf8-container", emit: "emitBoxedGptrarrayUtf8Container" },
    { signal: "some-boxed-gptrarray-utf8-full", emit: "emitBoxedGptrarrayUtf8Full" },
] as const)("$signal", ({ signal, emit }) => {
    test.each(listenerCounts)("marshals strings safely with %i listeners", (listeners) => {
        const object = GIMarshallingTests.SignalsObject.new();
        const received: string[][] = [];
        for (let index = 0; index < listeners; index += 1) {
            object.on(signal, (values) => {
                received.push(values);
            });
        }
        object[emit]();
        expect(received).toEqual(Array.from({ length: listeners }, () => ["0", "1", "2"]));
    });
});

describe.each([
    { signal: "some-boxed-gptrarray-boxed-struct", emit: "emitBoxedGptrarrayBoxedStruct" },
    { signal: "some-boxed-gptrarray-boxed-struct-container", emit: "emitBoxedGptrarrayBoxedStructContainer" },
    { signal: "some-boxed-gptrarray-boxed-struct-full", emit: "emitBoxedGptrarrayBoxedStructFull" },
] as const)("$signal", ({ signal, emit }) => {
    test.each(listenerCounts)("retains boxed values safely with %i listeners", (listeners) => {
        const object = GIMarshallingTests.SignalsObject.new();
        const received: GIMarshallingTests.BoxedStruct[][] = [];
        for (let index = 0; index < listeners; index += 1) {
            object.on(signal, (values) => {
                received.push(values);
            });
        }
        object[emit]();
        expect(received.map((values) => values.map((value) => value.long))).toEqual(
            Array.from({ length: listeners }, () => [42n, 43n, 44n]),
        );
    });
});

describe.each([
    { signal: "some-hash-table-utf8-int", emit: "emitHashTableUtf8Int" },
    { signal: "some-hash-table-utf8-int-container", emit: "emitHashTableUtf8IntContainer" },
    { signal: "some-hash-table-utf8-int-full", emit: "emitHashTableUtf8IntFull" },
] as const)("$signal", ({ signal, emit }) => {
    test.each(listenerCounts)("retains table entries safely with %i listeners", (listeners) => {
        const object = GIMarshallingTests.SignalsObject.new();
        const received: Map<string, number>[] = [];
        for (let index = 0; index < listeners; index += 1) {
            object.on(signal, (values) => {
                received.push(values);
            });
        }
        object[emit]();
        expect(received).toEqual(
            Array.from(
                { length: listeners },
                () =>
                    new Map([
                        ["-1", 1],
                        ["0", 0],
                        ["1", -1],
                        ["2", -2],
                    ]),
            ),
        );
    });
});

describe.each([
    { signal: "some-boxed-struct", emit: "emitBoxedStruct" },
    { signal: "some-boxed-struct-full", emit: "emitBoxedStructFull" },
] as const)("$signal", ({ signal, emit }) => {
    test.each(listenerCounts)("reads the struct contents safely with %i listeners", (listeners) => {
        const object = GIMarshallingTests.SignalsObject.new();
        const received: { long: bigint; string: string }[] = [];
        for (let index = 0; index < listeners; index += 1) {
            object.on(signal, (value) => {
                received.push({ long: value.long, string: value.string });
            });
        }
        object[emit]();
        expect(received).toEqual(
            Array.from({ length: listeners }, () => ({
                long: 99n,
                string: "a string",
            })),
        );
    });
});

import * as GIMarshallingTests from "@gtkx/gi/gimarshallingtests";
import * as GLib from "@gtkx/gi/glib";
import * as Regress from "@gtkx/gi/regress";
import { expect, test } from "vitest";

const input = ["🅰", "β", "c", "d"];
const output = ["a", "b", "¢", "🔠"];

const transfers = [
    {
        name: "fixed borrowed",
        input: GIMarshallingTests.fixedArrayUtf8NoneIn,
        output: GIMarshallingTests.fixedArrayUtf8NoneOut,
        returned: GIMarshallingTests.fixedArrayUtf8NoneReturn,
    },
    {
        name: "fixed container",
        input: GIMarshallingTests.fixedArrayUtf8ContainerIn,
        output: GIMarshallingTests.fixedArrayUtf8ContainerOut,
        returned: GIMarshallingTests.fixedArrayUtf8ContainerReturn,
    },
    {
        name: "fixed full",
        input: GIMarshallingTests.fixedArrayUtf8FullIn,
        output: GIMarshallingTests.fixedArrayUtf8FullOut,
        returned: GIMarshallingTests.fixedArrayUtf8FullReturn,
    },
    {
        name: "sized borrowed",
        input: GIMarshallingTests.lengthArrayUtf8NoneIn,
        output: GIMarshallingTests.lengthArrayUtf8NoneOut,
        returned: GIMarshallingTests.lengthArrayUtf8NoneReturn,
    },
    {
        name: "sized container",
        input: GIMarshallingTests.lengthArrayUtf8ContainerIn,
        output: GIMarshallingTests.lengthArrayUtf8ContainerOut,
        returned: GIMarshallingTests.lengthArrayUtf8ContainerReturn,
    },
    {
        name: "sized full",
        input: GIMarshallingTests.lengthArrayUtf8FullIn,
        output: GIMarshallingTests.lengthArrayUtf8FullOut,
        returned: GIMarshallingTests.lengthArrayUtf8FullReturn,
    },
    {
        name: "terminated borrowed",
        input: (value: string[]) => GIMarshallingTests.zeroTerminatedArrayUtf8NoneIn(value, null),
        output: GIMarshallingTests.zeroTerminatedArrayUtf8NoneOut,
        returned: GIMarshallingTests.zeroTerminatedArrayUtf8NoneReturn,
    },
    {
        name: "terminated container",
        input: (value: string[]) => GIMarshallingTests.zeroTerminatedArrayUtf8ContainerIn(value, null),
        output: GIMarshallingTests.zeroTerminatedArrayUtf8ContainerOut,
        returned: GIMarshallingTests.zeroTerminatedArrayUtf8ContainerReturn,
    },
    {
        name: "terminated full",
        input: (value: string[]) => GIMarshallingTests.zeroTerminatedArrayUtf8FullIn(value, null),
        output: GIMarshallingTests.zeroTerminatedArrayUtf8FullOut,
        returned: GIMarshallingTests.zeroTerminatedArrayUtf8FullReturn,
    },
];

test.each(transfers)("$name UTF-8 arrays preserve all elements in every direction", (transfer) => {
    const source = [...input];
    transfer.input(source);
    expect(source).toEqual(input);
    expect(transfer.output()).toEqual(output);
    expect(transfer.returned()).toEqual(output);
});

test.each([
    { name: "borrowed", call: GIMarshallingTests.arrayGvariantNoneIn },
    { name: "container", call: GIMarshallingTests.arrayGvariantContainerIn },
    { name: "full", call: GIMarshallingTests.arrayGvariantFullIn },
])("$name variant arrays preserve typed contents", ({ call }) => {
    const source = [new GLib.Variant("i", 27), new GLib.Variant("s", "Hello")];
    const result = call(source);
    expect(result.map((value) => value.unpack())).toEqual([27, "Hello"]);
    expect(source.map((value) => value.unpack())).toEqual([27, "Hello"]);
});

test("a fixed full-transfer object array yields independent usable wrappers", () => {
    const result = Regress.testArrayFixedOutObjects();
    expect(result).toHaveLength(2);
    expect(result[0]).toBeInstanceOf(Regress.TestObj);
    expect(result[1]).toBeInstanceOf(Regress.TestObj);
    expect(result[0]).not.toBe(result[1]);
});

test("string vectors and pointer-array ownership preserve their contents", () => {
    const vector = GIMarshallingTests.gstrvReturn();
    expect(vector).toEqual(["0", "1", "2"]);
    GIMarshallingTests.gstrvIn(vector);
    expect(Regress.testGarrayContainerReturn()).toEqual(["regress"]);
    expect(Regress.testGarrayFullReturn()).toEqual(["regress"]);
});

test("parallel arrays share their inferred length while preserving value types", () => {
    expect(() => GIMarshallingTests.multiArrayKeyValueIn(["one", "two", "three"], [1, 2, 3])).not.toThrow();
});

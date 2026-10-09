import * as GIMarshallingTests from "@gtkx/gi/gimarshallingtests";
import { expect, test } from "vitest";

const input = (): string[][] => [
    ["0", "1", "2"],
    ["3", "4", "5"],
    ["6", "7", "8"],
];
const replaced = (): string[][] => [
    ["-1", "0", "1", "2"],
    ["-1", "3", "4", "5"],
    ["-1", "6", "7", "8"],
    ["-1", "9", "10", "11"],
];

test.each([
    {
        name: "fixed borrowed",
        size: 3,
        take: GIMarshallingTests.fixedArrayOfGstrvTransferNoneIn,
        out: GIMarshallingTests.fixedArrayOfGstrvTransferNoneOut,
        returns: GIMarshallingTests.fixedArrayOfGstrvTransferNoneReturn,
        replace: GIMarshallingTests.fixedArrayOfGstrvTransferNoneInout,
    },
    {
        name: "fixed container",
        size: 3,
        take: GIMarshallingTests.fixedArrayOfGstrvTransferContainerIn,
        out: GIMarshallingTests.fixedArrayOfGstrvTransferContainerOut,
        returns: GIMarshallingTests.fixedArrayOfGstrvTransferContainerReturn,
        replace: GIMarshallingTests.fixedArrayOfGstrvTransferContainerInout,
    },
    {
        name: "fixed full",
        size: 3,
        take: GIMarshallingTests.fixedArrayOfGstrvTransferFullIn,
        out: GIMarshallingTests.fixedArrayOfGstrvTransferFullOut,
        returns: GIMarshallingTests.fixedArrayOfGstrvTransferFullReturn,
        replace: GIMarshallingTests.fixedArrayOfGstrvTransferFullInout,
    },
    {
        name: "length borrowed",
        size: 4,
        take: GIMarshallingTests.lengthArrayOfGstrvTransferNoneIn,
        out: GIMarshallingTests.lengthArrayOfGstrvTransferNoneOut,
        returns: GIMarshallingTests.lengthArrayOfGstrvTransferNoneReturn,
        replace: GIMarshallingTests.lengthArrayOfGstrvTransferNoneInout,
    },
    {
        name: "length container",
        size: 4,
        take: GIMarshallingTests.lengthArrayOfGstrvTransferContainerIn,
        out: GIMarshallingTests.lengthArrayOfGstrvTransferContainerOut,
        returns: GIMarshallingTests.lengthArrayOfGstrvTransferContainerReturn,
        replace: GIMarshallingTests.lengthArrayOfGstrvTransferContainerInout,
    },
    {
        name: "length full",
        size: 4,
        take: GIMarshallingTests.lengthArrayOfGstrvTransferFullIn,
        out: GIMarshallingTests.lengthArrayOfGstrvTransferFullOut,
        returns: GIMarshallingTests.lengthArrayOfGstrvTransferFullReturn,
        replace: GIMarshallingTests.lengthArrayOfGstrvTransferFullInout,
    },
    {
        name: "terminated borrowed",
        size: 4,
        take: GIMarshallingTests.zeroTerminatedArrayOfGstrvTransferNoneIn,
        out: GIMarshallingTests.zeroTerminatedArrayOfGstrvTransferNoneOut,
        returns: GIMarshallingTests.zeroTerminatedArrayOfGstrvTransferNoneReturn,
        replace: GIMarshallingTests.zeroTerminatedArrayOfGstrvTransferNoneInout,
    },
    {
        name: "terminated container",
        size: 4,
        take: GIMarshallingTests.zeroTerminatedArrayOfGstrvTransferContainerIn,
        out: GIMarshallingTests.zeroTerminatedArrayOfGstrvTransferContainerOut,
        returns: GIMarshallingTests.zeroTerminatedArrayOfGstrvTransferContainerReturn,
        replace: GIMarshallingTests.zeroTerminatedArrayOfGstrvTransferContainerInout,
    },
    {
        name: "terminated full",
        size: 4,
        take: GIMarshallingTests.zeroTerminatedArrayOfGstrvTransferFullIn,
        out: GIMarshallingTests.zeroTerminatedArrayOfGstrvTransferFullOut,
        returns: GIMarshallingTests.zeroTerminatedArrayOfGstrvTransferFullReturn,
        replace: GIMarshallingTests.zeroTerminatedArrayOfGstrvTransferFullInout,
    },
])("$name nested arrays preserve inner values in every direction", ({ size, take, out, returns, replace }) => {
    const values = input();
    take(values);
    expect(out()).toEqual(input());
    expect(returns()).toEqual(input());
    expect(replace(values)).toEqual(replaced().slice(0, size));
    expect(values).toEqual(input());
});

test("nested argument validation releases already encoded owned rows", () => {
    expect(() => {
        Reflect.apply(GIMarshallingTests.fixedArrayOfGstrvTransferFullIn, undefined, [
            [
                ["0", "1", "2"],
                ["3", "4", "5"],
                ["6", 7, "8"],
            ],
        ]);
    }).toThrow(/string/i);
});

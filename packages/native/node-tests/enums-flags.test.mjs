import assert from "node:assert/strict";
import { test } from "node:test";
import * as GIMarshallingTests from "@gtkx/gi/gimarshallingtests";
import * as Regress from "@gtkx/gi/regress";
import * as Utility from "@gtkx/gi/utility";
import * as WarnLib from "@gtkx/gi/warnlib";
import { installMemoryGuard } from "./helpers/memory.mjs";

installMemoryGuard();

test("marshalling enum members mirror the C header values", () => {
    assert.equal(GIMarshallingTests.Enum.VALUE1, 0);
    assert.equal(GIMarshallingTests.Enum.VALUE2, 1);
    assert.equal(GIMarshallingTests.Enum.VALUE3, 42);
    assert.equal(GIMarshallingTests.GEnum.VALUE1, 0);
    assert.equal(GIMarshallingTests.GEnum.VALUE2, 1);
    assert.equal(GIMarshallingTests.GEnum.VALUE3, 42);
    assert.equal(GIMarshallingTests.SecondEnum.SECONDVALUE1, 0);
    assert.equal(GIMarshallingTests.SecondEnum.SECONDVALUE2, 1);
    assert.equal(GIMarshallingTests.ExtraEnum.VALUE1, 0);
    assert.equal(GIMarshallingTests.ExtraEnum.VALUE2, 1);
    assert.equal(GIMarshallingTests.ExtraEnum.VALUE3, 42);
});

test("marshalling flags members mirror the C header values including masks", () => {
    assert.equal(GIMarshallingTests.Flags.VALUE1, 1);
    assert.equal(GIMarshallingTests.Flags.VALUE2, 2);
    assert.equal(GIMarshallingTests.Flags.VALUE3, 4);
    assert.equal(GIMarshallingTests.Flags.MASK, 3);
    assert.equal(GIMarshallingTests.Flags.MASK2, 3);
    assert.equal(GIMarshallingTests.NoTypeFlags.VALUE1, 1);
    assert.equal(GIMarshallingTests.NoTypeFlags.VALUE2, 2);
    assert.equal(GIMarshallingTests.NoTypeFlags.VALUE3, 4);
    assert.equal(GIMarshallingTests.NoTypeFlags.MASK, 3);
    assert.equal(GIMarshallingTests.NoTypeFlags.MASK2, 3);
    assert.equal(GIMarshallingTests.ExtraFlags.VALUE1, 0);
    assert.equal(GIMarshallingTests.ExtraFlags.VALUE2, 2147483648);
});

test("regress enum members carry negative, character and unsigned values", () => {
    assert.equal(Regress.TestEnum.VALUE1, 0);
    assert.equal(Regress.TestEnum.VALUE2, 1);
    assert.equal(Regress.TestEnum.VALUE3, -1);
    assert.equal(Regress.TestEnum.VALUE4, 48);
    assert.equal(Regress.TestEnum.VALUE5, 49);
    assert.equal(Regress.TestEnumUnsigned.VALUE1, 1);
    assert.equal(Regress.TestEnumUnsigned.VALUE2, 2147483648);
    assert.equal(Regress.TestEnumNoGEnum.EVALUE1, 0);
    assert.equal(Regress.TestEnumNoGEnum.EVALUE2, 42);
    assert.equal(Regress.TestEnumNoGEnum.EVALUE3, 48);
    assert.equal(Regress.TestReferenceEnum.ZERO, 4);
    assert.equal(Regress.TestReferenceEnum.ONE, 2);
    assert.equal(Regress.TestReferenceEnum.TWO, 54);
    assert.equal(Regress.TestReferenceEnum.THREE, 4);
    assert.equal(Regress.TestReferenceEnum.FOUR, 216);
    assert.equal(Regress.TestReferenceEnum.FIVE, -217);
});

test("regress, utility and warnlib flags members are exposed", () => {
    assert.equal(Regress.TestFlags.FLAG1, 1);
    assert.equal(Regress.TestFlags.FLAG2, 2);
    assert.equal(Regress.TestFlags.FLAG3, 4);
    assert.equal(Regress.TestDiscontinuousFlags.DISCONTINUOUS1, 512);
    assert.equal(Regress.TestDiscontinuousFlags.DISCONTINUOUS2, 536870912);
    assert.equal(Regress.TestPrivateEnum.PUBLIC_ENUM_BEFORE, 1);
    assert.equal(Regress.TestPrivateEnum.PUBLIC_ENUM_AFTER, 4);
    assert.equal(Regress.FooEnumType.ALPHA, 0);
    assert.equal(Regress.FooEnumType.BETA, 1);
    assert.equal(Regress.FooEnumType.DELTA, 2);
    assert.equal(Utility.EnumType.A, 0);
    assert.equal(Utility.EnumType.B, 1);
    assert.equal(Utility.EnumType.C, 2);
    assert.equal(Utility.FlagType.A, 1);
    assert.equal(Utility.FlagType.B, 2);
    assert.equal(Utility.FlagType.C, 4);
    assert.equal(WarnLib.NumericEnum._1ST, 1);
});

test("plain enums round trip through return, in, out and inout", () => {
    assert.equal(GIMarshallingTests.enumReturnv(), GIMarshallingTests.Enum.VALUE3);
    GIMarshallingTests.enumIn(GIMarshallingTests.Enum.VALUE3);
    assert.equal(GIMarshallingTests.enumOut(), GIMarshallingTests.Enum.VALUE3);
    assert.equal(GIMarshallingTests.enumInout(GIMarshallingTests.Enum.VALUE3), GIMarshallingTests.Enum.VALUE1);
});

test("registered genums round trip through return, in, out and inout", () => {
    assert.equal(GIMarshallingTests.genumReturnv(), GIMarshallingTests.GEnum.VALUE3);
    GIMarshallingTests.genumIn(GIMarshallingTests.GEnum.VALUE3);
    assert.equal(GIMarshallingTests.genumOut(), GIMarshallingTests.GEnum.VALUE3);
    assert.equal(GIMarshallingTests.genumInout(GIMarshallingTests.GEnum.VALUE3), GIMarshallingTests.GEnum.VALUE1);
});

test("registered flags round trip through return, in, out and inout", () => {
    assert.equal(GIMarshallingTests.flagsReturnv(), GIMarshallingTests.Flags.VALUE2);
    GIMarshallingTests.flagsIn(GIMarshallingTests.Flags.VALUE2);
    GIMarshallingTests.flagsInZero(0);
    assert.equal(GIMarshallingTests.flagsOut(), GIMarshallingTests.Flags.VALUE2);
    assert.equal(GIMarshallingTests.flagsInout(GIMarshallingTests.Flags.VALUE2), GIMarshallingTests.Flags.VALUE1);
});

test("flags without a gtype round trip through return, in, out and inout", () => {
    assert.equal(GIMarshallingTests.noTypeFlagsReturnv(), GIMarshallingTests.NoTypeFlags.VALUE2);
    GIMarshallingTests.noTypeFlagsIn(GIMarshallingTests.NoTypeFlags.VALUE2);
    GIMarshallingTests.noTypeFlagsInZero(0);
    assert.equal(GIMarshallingTests.noTypeFlagsOut(), GIMarshallingTests.NoTypeFlags.VALUE2);
    assert.equal(
        GIMarshallingTests.noTypeFlagsInout(GIMarshallingTests.NoTypeFlags.VALUE2),
        GIMarshallingTests.NoTypeFlags.VALUE1,
    );
});

test("extra enum arrays and large unsigned flags values marshal", () => {
    assert.deepEqual(GIMarshallingTests.enumArrayReturnType(), [
        GIMarshallingTests.ExtraEnum.VALUE1,
        GIMarshallingTests.ExtraEnum.VALUE2,
        GIMarshallingTests.ExtraEnum.VALUE3,
    ]);
    GIMarshallingTests.extraFlagsLargeIn(GIMarshallingTests.ExtraFlags.VALUE2);
});

test("regress enum params resolve to their registered nicks", () => {
    assert.equal(Regress.testEnumParam(Regress.TestEnum.VALUE1), "value1");
    assert.equal(Regress.testEnumParam(Regress.TestEnum.VALUE2), "value2");
    assert.equal(Regress.testEnumParam(Regress.TestEnum.VALUE3), "value3");
    assert.equal(Regress.testEnumParam(Regress.TestEnum.VALUE4), "value4");
    assert.equal(Regress.testUnsignedEnumParam(Regress.TestEnumUnsigned.VALUE1), "value1");
});

test("flags out slots decode combined and private bits", () => {
    assert.equal(Regress.globalGetFlagsOut(), Regress.TestFlags.FLAG1 | Regress.TestFlags.FLAG3);
    assert.equal(Regress.globalGetFlagsOut(), 5);
    assert.equal(
        Regress.testDiscontinuous1WithPrivateValues(),
        (1 << 3) | Regress.TestDiscontinuousFlags.DISCONTINUOUS1,
    );
    assert.equal(
        Regress.testDiscontinuous2WithPrivateValues(),
        (1 << 30) | Regress.TestDiscontinuousFlags.DISCONTINUOUS2,
    );
});

test("flags combinations are accepted through method arguments", () => {
    const object = new GIMarshallingTests.PropertiesAccessorsObject({});
    object.setFlags(GIMarshallingTests.Flags.VALUE1 | GIMarshallingTests.Flags.VALUE3);
    assert.equal(object.getFlags(), GIMarshallingTests.Flags.VALUE1 | GIMarshallingTests.Flags.VALUE3);
    object.setEnum(GIMarshallingTests.GEnum.VALUE3);
    assert.equal(object.getEnum(), GIMarshallingTests.GEnum.VALUE3);
});

test("utility enums and flags cross namespace boundaries", () => {
    const object = new Utility.Object({});
    const struct = new Utility.Struct({});
    Regress.fooMethodExternalReferences(object, Utility.EnumType.B, Utility.FlagType.A | Utility.FlagType.C, struct);
});

test("foo enum helpers convert between ints and members", () => {
    assert.equal(Regress.fooEnumTypeMethod(Regress.FooEnumType.ALPHA), 1);
    assert.equal(Regress.fooEnumTypeMethod(Regress.FooEnumType.BETA), 2);
    assert.equal(Regress.fooEnumTypeReturnv(0), Regress.FooEnumType.BETA);
    assert.equal(Regress.fooEnumTypeReturnv(2), Regress.FooEnumType.ALPHA);
});

test("null is accepted as zero where the C side expects zero flags", () => {
    GIMarshallingTests.flagsInZero(null);
    GIMarshallingTests.noTypeFlagsInZero(null);
});

test("enum arguments reject wrong types and out-of-range values", () => {
    assert.throws(() => GIMarshallingTests.enumIn(1.5));
    assert.throws(() => GIMarshallingTests.enumIn(-1));
    assert.throws(() => GIMarshallingTests.enumIn(2 ** 32));
    assert.throws(() => GIMarshallingTests.enumIn("VALUE3"));
    assert.throws(() => GIMarshallingTests.enumIn(Symbol("nope")));
    assert.throws(() => Regress.testEnumParam(2 ** 31));
    assert.throws(() => GIMarshallingTests.flagsInZero(undefined));
});

test("registered enum arguments reject non-member values", () => {
    assert.throws(() => GIMarshallingTests.genumIn(9999));
    assert.throws(() => GIMarshallingTests.genumIn(2));
    assert.throws(() => Regress.testEnumParam(9999));
    assert.throws(() => Regress.testEnumParam(2));
    assert.throws(() => Regress.testUnsignedEnumParam(9999));
});

test("flags arguments reject bits outside the mask", () => {
    assert.throws(() => GIMarshallingTests.flagsIn(8));
    assert.throws(() => GIMarshallingTests.flagsIn(GIMarshallingTests.Flags.VALUE1 | 8));
    assert.throws(() => GIMarshallingTests.flagsIn(-1));
    assert.throws(() => GIMarshallingTests.noTypeFlagsIn(16));
    assert.throws(() => GIMarshallingTests.extraFlagsLargeIn(GIMarshallingTests.ExtraFlags.VALUE2 + 1));
});

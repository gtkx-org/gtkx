import * as GIMarshallingTests from "@gtkx/gi/gimarshallingtests";
import * as Regress from "@gtkx/gi/regress";
import * as Utility from "@gtkx/gi/utility";
import * as WarnLib from "@gtkx/gi/warnlib";
import { expect, test } from "vitest";
import { drainAfterEachTest } from "./helpers/memory.js";

drainAfterEachTest();

test("marshalling enum members mirror the C header values", () => {
    expect(GIMarshallingTests.Enum.VALUE1).toBe(0);
    expect(GIMarshallingTests.Enum.VALUE2).toBe(1);
    expect(GIMarshallingTests.Enum.VALUE3).toBe(42);
    expect(GIMarshallingTests.GEnum.VALUE1).toBe(0);
    expect(GIMarshallingTests.GEnum.VALUE2).toBe(1);
    expect(GIMarshallingTests.GEnum.VALUE3).toBe(42);
    expect(GIMarshallingTests.SecondEnum.SECONDVALUE1).toBe(0);
    expect(GIMarshallingTests.SecondEnum.SECONDVALUE2).toBe(1);
    expect(GIMarshallingTests.ExtraEnum.VALUE1).toBe(0);
    expect(GIMarshallingTests.ExtraEnum.VALUE2).toBe(1);
    expect(GIMarshallingTests.ExtraEnum.VALUE3).toBe(42);
});

test("marshalling flags members mirror the C header values including masks", () => {
    expect(GIMarshallingTests.Flags.VALUE1).toBe(1);
    expect(GIMarshallingTests.Flags.VALUE2).toBe(2);
    expect(GIMarshallingTests.Flags.VALUE3).toBe(4);
    expect(GIMarshallingTests.Flags.MASK).toBe(3);
    expect(GIMarshallingTests.Flags.MASK2).toBe(3);
    expect(GIMarshallingTests.NoTypeFlags.VALUE1).toBe(1);
    expect(GIMarshallingTests.NoTypeFlags.VALUE2).toBe(2);
    expect(GIMarshallingTests.NoTypeFlags.VALUE3).toBe(4);
    expect(GIMarshallingTests.NoTypeFlags.MASK).toBe(3);
    expect(GIMarshallingTests.NoTypeFlags.MASK2).toBe(3);
    expect(GIMarshallingTests.ExtraFlags.VALUE1).toBe(0);
    expect(GIMarshallingTests.ExtraFlags.VALUE2).toBe(2_147_483_648);
});

test("regress enum members carry negative, character and unsigned values", () => {
    expect(Regress.TestEnum.VALUE1).toBe(0);
    expect(Regress.TestEnum.VALUE2).toBe(1);
    expect(Regress.TestEnum.VALUE3).toBe(-1);
    expect(Regress.TestEnum.VALUE4).toBe(48);
    expect(Regress.TestEnum.VALUE5).toBe(49);
    expect(Regress.TestEnumUnsigned.VALUE1).toBe(1);
    expect(Regress.TestEnumUnsigned.VALUE2).toBe(2_147_483_648);
    expect(Regress.TestEnumNoGEnum.EVALUE1).toBe(0);
    expect(Regress.TestEnumNoGEnum.EVALUE2).toBe(42);
    expect(Regress.TestEnumNoGEnum.EVALUE3).toBe(48);
    expect(Regress.TestReferenceEnum.ZERO).toBe(4);
    expect(Regress.TestReferenceEnum.ONE).toBe(2);
    expect(Regress.TestReferenceEnum.TWO).toBe(54);
    expect(Regress.TestReferenceEnum.THREE).toBe(4);
    expect(Regress.TestReferenceEnum.FOUR).toBe(216);
    expect(Regress.TestReferenceEnum.FIVE).toBe(-217);
});

test("regress, utility and warnlib flags members are exposed", () => {
    expect(Regress.TestFlags.FLAG1).toBe(1);
    expect(Regress.TestFlags.FLAG2).toBe(2);
    expect(Regress.TestFlags.FLAG3).toBe(4);
    expect(Regress.TestDiscontinuousFlags.DISCONTINUOUS1).toBe(512);
    expect(Regress.TestDiscontinuousFlags.DISCONTINUOUS2).toBe(536_870_912);
    expect(Regress.TestPrivateEnum.PUBLIC_ENUM_BEFORE).toBe(1);
    expect(Regress.TestPrivateEnum.PUBLIC_ENUM_AFTER).toBe(4);
    expect(Regress.FooEnumType.ALPHA).toBe(0);
    expect(Regress.FooEnumType.BETA).toBe(1);
    expect(Regress.FooEnumType.DELTA).toBe(2);
    expect(Utility.EnumType.A).toBe(0);
    expect(Utility.EnumType.B).toBe(1);
    expect(Utility.EnumType.C).toBe(2);
    expect(Utility.FlagType.A).toBe(1);
    expect(Utility.FlagType.B).toBe(2);
    expect(Utility.FlagType.C).toBe(4);
    expect(WarnLib.NumericEnum._1ST).toBe(1);
});

test("plain enums round trip through return, in, out and inout", () => {
    expect(GIMarshallingTests.enumReturnv()).toBe(GIMarshallingTests.Enum.VALUE3);
    GIMarshallingTests.enumIn(GIMarshallingTests.Enum.VALUE3);
    expect(GIMarshallingTests.enumOut()).toBe(GIMarshallingTests.Enum.VALUE3);
    expect(GIMarshallingTests.enumInout(GIMarshallingTests.Enum.VALUE3)).toBe(GIMarshallingTests.Enum.VALUE1);
});

test("registered genums round trip through return, in, out and inout", () => {
    expect(GIMarshallingTests.genumReturnv()).toBe(GIMarshallingTests.GEnum.VALUE3);
    GIMarshallingTests.genumIn(GIMarshallingTests.GEnum.VALUE3);
    expect(GIMarshallingTests.genumOut()).toBe(GIMarshallingTests.GEnum.VALUE3);
    expect(GIMarshallingTests.genumInout(GIMarshallingTests.GEnum.VALUE3)).toBe(GIMarshallingTests.GEnum.VALUE1);
});

test("registered flags round trip through return, in, out and inout", () => {
    expect(GIMarshallingTests.flagsReturnv()).toBe(GIMarshallingTests.Flags.VALUE2);
    GIMarshallingTests.flagsIn(GIMarshallingTests.Flags.VALUE2);
    // @ts-expect-error zero is not a declared Flags member
    GIMarshallingTests.flagsInZero(0);
    expect(GIMarshallingTests.flagsOut()).toBe(GIMarshallingTests.Flags.VALUE2);
    expect(GIMarshallingTests.flagsInout(GIMarshallingTests.Flags.VALUE2)).toBe(GIMarshallingTests.Flags.VALUE1);
});

test("flags without a gtype round trip through return, in, out and inout", () => {
    expect(GIMarshallingTests.noTypeFlagsReturnv()).toBe(GIMarshallingTests.NoTypeFlags.VALUE2);
    GIMarshallingTests.noTypeFlagsIn(GIMarshallingTests.NoTypeFlags.VALUE2);
    // @ts-expect-error zero is not a declared NoTypeFlags member
    GIMarshallingTests.noTypeFlagsInZero(0);
    expect(GIMarshallingTests.noTypeFlagsOut()).toBe(GIMarshallingTests.NoTypeFlags.VALUE2);
    expect(GIMarshallingTests.noTypeFlagsInout(GIMarshallingTests.NoTypeFlags.VALUE2)).toBe(
        GIMarshallingTests.NoTypeFlags.VALUE1,
    );
});

test("extra enum arrays and large unsigned flags values marshal", () => {
    expect(GIMarshallingTests.enumArrayReturnType()).toEqual([
        GIMarshallingTests.ExtraEnum.VALUE1,
        GIMarshallingTests.ExtraEnum.VALUE2,
        GIMarshallingTests.ExtraEnum.VALUE3,
    ]);
    GIMarshallingTests.extraFlagsLargeIn(GIMarshallingTests.ExtraFlags.VALUE2);
});

test("regress enum params resolve to their registered nicks", () => {
    expect(Regress.testEnumParam(Regress.TestEnum.VALUE1)).toBe("value1");
    expect(Regress.testEnumParam(Regress.TestEnum.VALUE2)).toBe("value2");
    expect(Regress.testEnumParam(Regress.TestEnum.VALUE3)).toBe("value3");
    expect(Regress.testEnumParam(Regress.TestEnum.VALUE4)).toBe("value4");
    expect(Regress.testUnsignedEnumParam(Regress.TestEnumUnsigned.VALUE1)).toBe("value1");
});

test("flags out slots decode combined and private bits", () => {
    expect(Regress.globalGetFlagsOut()).toBe(Regress.TestFlags.FLAG1 | Regress.TestFlags.FLAG3);
    expect(Regress.globalGetFlagsOut()).toBe(5);
    expect(Regress.testDiscontinuous1WithPrivateValues()).toBe(
        (1 << 3) | Regress.TestDiscontinuousFlags.DISCONTINUOUS1,
    );
    expect(Regress.testDiscontinuous2WithPrivateValues()).toBe(
        (1 << 30) | Regress.TestDiscontinuousFlags.DISCONTINUOUS2,
    );
});

test("flags combinations are accepted through method arguments", () => {
    const object = new GIMarshallingTests.PropertiesAccessorsObject({});
    object.setFlags(GIMarshallingTests.Flags.VALUE1 | GIMarshallingTests.Flags.VALUE3);
    expect(object.getFlags()).toBe(GIMarshallingTests.Flags.VALUE1 | GIMarshallingTests.Flags.VALUE3);
    object.setEnum(GIMarshallingTests.GEnum.VALUE3);
    expect(object.getEnum()).toBe(GIMarshallingTests.GEnum.VALUE3);
});

test("utility types cross namespace boundaries", () => {
    const object = new Utility.Object({});
    const fooObject = Regress.FooObject.new();
    const holder = new Regress.FooUtilityStruct({ bar: new Utility.Struct({ field: 7 }) });

    Regress.FooObject.aGlobalMethod(object);
    fooObject.handleGlyph(65);

    expect(fooObject.externalType()).toBeNull();
    expect(holder.bar.field).toBe(7);
    expect(Utility.EnumType.A).toBe(0);
    expect(Utility.EnumType.B).toBe(1);
    expect(Utility.EnumType.C).toBe(2);
    expect(Utility.FlagType.A | Utility.FlagType.C).toBe(5);
});

test("foo enum helpers convert between ints and members", () => {
    expect(Regress.fooEnumTypeMethod(Regress.FooEnumType.ALPHA)).toBe(1);
    expect(Regress.fooEnumTypeMethod(Regress.FooEnumType.BETA)).toBe(2);
    expect(Regress.fooEnumTypeReturnv(0)).toBe(Regress.FooEnumType.BETA);
    expect(Regress.fooEnumTypeReturnv(2)).toBe(Regress.FooEnumType.ALPHA);
});

test("null is accepted as zero where the C side expects zero flags", () => {
    // @ts-expect-error the flags parameter is not nullable
    GIMarshallingTests.flagsInZero(null);
    // @ts-expect-error the flags parameter is not nullable
    GIMarshallingTests.noTypeFlagsInZero(null);

    const object = new GIMarshallingTests.PropertiesAccessorsObject({});
    // @ts-expect-error the flags parameter is not nullable
    object.setFlags(null);
    expect(object.getFlags()).toBe(0);
});

test("enum arguments reject wrong types and out-of-range values", () => {
    expect(() => {
        // @ts-expect-error 1.5 is not an Enum member
        GIMarshallingTests.enumIn(1.5);
    }).toThrow();
    expect(() => {
        // @ts-expect-error -1 is not an Enum member
        GIMarshallingTests.enumIn(-1);
    }).toThrow();
    expect(() => {
        GIMarshallingTests.enumIn(2 ** 32);
    }).toThrow();
    expect(() => {
        // @ts-expect-error a string is not an Enum member
        GIMarshallingTests.enumIn("VALUE3");
    }).toThrow();
    expect(() => {
        // @ts-expect-error a symbol is not an Enum member
        GIMarshallingTests.enumIn(Symbol("nope"));
    }).toThrow();
    expect(() => Regress.testEnumParam(2 ** 31)).toThrow();
    expect(() => {
        // @ts-expect-error the flags parameter is not optional
        GIMarshallingTests.flagsInZero();
    }).toThrow();
});

test("an enum with no registered GType validates membership from the GIR", () => {
    GIMarshallingTests.enumIn(GIMarshallingTests.Enum.VALUE3);
    expect(GIMarshallingTests.enumInout(GIMarshallingTests.Enum.VALUE3)).toBe(GIMarshallingTests.Enum.VALUE1);

    expect(() => {
        // @ts-expect-error 9999 is not an Enum member
        GIMarshallingTests.enumIn(9999);
    }).toThrow();
    expect(() => {
        // @ts-expect-error 2 is not an Enum member
        GIMarshallingTests.enumIn(2);
    }).toThrow();
});

test("an unregistered enum argument rejects a value outside its members", () => {
    const union = GIMarshallingTests.StructuredUnion.new(GIMarshallingTests.StructuredUnionType.SIMPLE_STRUCT);
    expect(union.type()).toBe(GIMarshallingTests.StructuredUnionType.SIMPLE_STRUCT);

    // @ts-expect-error 99 is not a StructuredUnionType member
    expect(() => GIMarshallingTests.StructuredUnion.new(99)).toThrow();
});

test("the argument path and the field path reject the same enum value", () => {
    const struct = new Regress.TestStructA({});
    struct.someEnum = Regress.TestEnum.VALUE2;
    expect(struct.someEnum).toBe(Regress.TestEnum.VALUE2);
    expect(Regress.testEnumParam(Regress.TestEnum.VALUE2)).toBe("value2");

    // @ts-expect-error 12345 is not a TestEnum member
    expect(() => Regress.testEnumParam(12_345)).toThrow();
    expect(() => {
        // @ts-expect-error 12345 is not a TestEnum member
        struct.someEnum = 12_345;
    }).toThrow();
});

test("registered enum arguments reject non-member values", () => {
    expect(() => {
        // @ts-expect-error 9999 is not a GEnum member
        GIMarshallingTests.genumIn(9999);
    }).toThrow();
    expect(() => {
        // @ts-expect-error 2 is not a GEnum member
        GIMarshallingTests.genumIn(2);
    }).toThrow();
    // @ts-expect-error 9999 is not a TestEnum member
    expect(() => Regress.testEnumParam(9999)).toThrow();
    // @ts-expect-error 2 is not a TestEnum member
    expect(() => Regress.testEnumParam(2)).toThrow();
    // @ts-expect-error 9999 is not a TestEnumUnsigned member
    expect(() => Regress.testUnsignedEnumParam(9999)).toThrow();
});

test("flags arguments reject bits outside the mask", () => {
    expect(() => {
        // @ts-expect-error 8 is not a Flags member
        GIMarshallingTests.flagsIn(8);
    }).toThrow();
    expect(() => {
        GIMarshallingTests.flagsIn(GIMarshallingTests.Flags.VALUE1 | 8);
    }).toThrow();
    expect(() => {
        // @ts-expect-error -1 is not a Flags member
        GIMarshallingTests.flagsIn(-1);
    }).toThrow();
    expect(() => {
        // @ts-expect-error 16 is not a NoTypeFlags member
        GIMarshallingTests.noTypeFlagsIn(16);
    }).toThrow();
    expect(() => {
        GIMarshallingTests.extraFlagsLargeIn(GIMarshallingTests.ExtraFlags.VALUE2 + 1);
    }).toThrow();
});

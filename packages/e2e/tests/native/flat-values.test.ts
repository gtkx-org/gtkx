import * as GIMarshallingTests from "@gtkx/gi/gimarshallingtests";
import * as GObject from "@gtkx/gi/gobject";
import * as Regress from "@gtkx/gi/regress";
import { expect, test } from "vitest";
import { drainGC } from "./helpers/memory.js";

test.each([GIMarshallingTests.returnGvalueFlatArray, GIMarshallingTests.returnGvalueZeroTerminatedArray])(
    "%s returns independently owned inline values",
    async (create) => {
        const values = create();
        expect(values).toHaveLength(3);
        const [integer, string, boolean] = values;
        if (integer === undefined || string === undefined || boolean === undefined) throw new Error("Missing GValue");
        expect(integer.getInt()).toBe(42);
        expect(string.getString()).toBe("42");
        expect(boolean.getBoolean()).toBe(true);
        GIMarshallingTests.gvalueFlatArray(values);
        string.setString("owned after decoding");
        await drainGC();
        expect(integer.getInt()).toBe(42);
        expect(string.getString()).toBe("owned after decoding");
        expect(boolean.getBoolean()).toBe(true);
    },
);

test("terminated inline boxed records have independent storage", async () => {
    const values = GIMarshallingTests.arrayZeroTerminatedReturnSequentialStruct();
    expect(values.map((value) => value.long)).toEqual([42n, 43n, 44n]);
    const first = values[0];
    if (first === undefined) throw new Error("Missing inline boxed record");
    first.string = "owned member";
    await drainGC();
    expect(first.string).toBe("owned member");
    expect(values.map((value) => value.long)).toEqual([42n, 43n, 44n]);
});

test("fixed pointer arrays retain boxed references independently", async () => {
    const values = Regress.testArrayFixedBoxedNoneOut();
    expect(values).toHaveLength(2);
    expect(values.map((value) => value.anotherThing)).toEqual([42, 42]);
    await drainGC();
    expect(values.map((value) => value.refcount)).toEqual([2, 2]);
    expect(values.map((value) => value.anotherThing)).toEqual([42, 42]);
});

test("GValues passed by value preserve independent scalar payloads", () => {
    const integer = new GObject.Value();
    integer.init(GObject.TYPE_INT);
    integer.setInt(42);
    const number = new GObject.Value();
    number.init(GObject.TYPE_DOUBLE);
    number.setDouble(2.5);
    const boolean = new GObject.Value();
    boolean.init(GObject.TYPE_BOOLEAN);
    boolean.setBoolean(true);
    const values = GIMarshallingTests.gvalueFlatArrayRoundTrip(integer, number, boolean);
    const [copiedInteger, copiedNumber, copiedBoolean] = values;
    if (copiedInteger === undefined || copiedNumber === undefined || copiedBoolean === undefined) {
        throw new Error("Missing copied GValue");
    }
    integer.setInt(99);
    number.setDouble(9.5);
    boolean.setBoolean(false);
    expect(copiedInteger.getInt()).toBe(42);
    expect(copiedNumber.getDouble()).toBe(2.5);
    expect(copiedBoolean.getBoolean()).toBe(true);
});

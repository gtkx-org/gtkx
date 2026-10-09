import * as GIMarshallingTests from "@gtkx/gi/gimarshallingtests";
import * as GObject from "@gtkx/gi/gobject";
import * as Regress from "@gtkx/gi/regress";
import { onLog } from "@gtkx/runtime";
import { expect, test } from "vitest";
import { drainGC } from "./helpers/memory.js";

test("annotation no-op properties retain the values returned by native getters", () => {
    const object = new Regress.AnnotationObject({
        stringProperty: "initial",
        tabProperty: "initial",
        functionProperty: null,
    });
    object.stringProperty = "updated";
    object.tabProperty = "updated";
    object.functionProperty = null;
    GObject.setProperty(object, "functionProperty", (value) => value + 1);
    expect(object.stringProperty).toBeNull();
    expect(object.tabProperty).toBeNull();
    expect(object.functionProperty).toBeNull();
    expect(GObject.getProperty(object, "functionProperty")).toBeNull();
    GObject.setProperty(object, "functionProperty", null);
});

test("annotated pointer list properties copy their input and preserve aliases", () => {
    const values = ["first", "second"];
    const object = new Regress.TestObj({ listOld: values });
    values[0] = "changed";
    expect(object.listOld).toEqual(["first", "second"]);
    expect(object.list).toEqual(["first", "second"]);
    object.listOld = ["third"];
    expect(object.list).toEqual(["third"]);
    expect(GObject.getProperty(object, "listOld")).toEqual(["third"]);
    GObject.setProperty(object, "list", ["fourth"]);
    expect(object.listOld).toEqual(["fourth"]);
    object.list = ["fifth"];
    expect(object.listOld).toEqual(["fifth"]);
    GObject.setProperty(object, "list", null);
    expect(object.listOld).toBeNull();
});

test("hash table property aliases share their native container", async () => {
    const object = new Regress.TestObj({});
    expect(object.hashTable).toBeNull();
    expect(object.hashTableOld).toBeNull();
    object.hashTable = new Map([
        ["negative", -12],
        ["positive", 37],
    ]);
    expect(object.hashTableOld).toEqual(
        new Map([
            ["negative", -12],
            ["positive", 37],
        ]),
    );
    await drainGC();
    expect(GObject.getProperty(object, "hashTable")).toEqual(
        new Map([
            ["negative", -12],
            ["positive", 37],
        ]),
    );
    object.hashTableOld = new Map([["replacement", 42]]);
    await drainGC();
    expect(object.hashTable).toEqual(new Map([["replacement", 42]]));
    expect(object.hashTable).toEqual(new Map([["replacement", 42]]));
});

test("the annotation-only pointer array property reports its absent native implementation", async () => {
    const messages: string[] = [];
    const subscription = onLog((level, _domain, message) => {
        if (level === "warning" && message.includes("pptrarray")) messages.push(message);
    });
    try {
        const object = new Regress.TestObj({});
        object.pptrarray = ["first", "second"];
        expect(object.pptrarray).toBeNull();
        await expect.poll(() => messages.length).toBe(2);
        expect(messages.every((message) => message.includes("invalid property id"))).toBe(true);
    } finally {
        subscription.unsubscribe();
    }
});

test.each([GIMarshallingTests.PropertiesObject, GIMarshallingTests.PropertiesAccessorsObject])(
    "%s constructors preserve custom boxed collections",
    (ObjectClass) => {
        const instance = new ObjectClass({ someBoxedGlist: [-2, 0, 5], someHashTable: new Map([[5, "five"]]) });
        expect(instance.someBoxedGlist).toEqual([-2, 0, 5]);
        expect(instance.someHashTable).toEqual(new Map([[5, "five"]]));
        expect(GObject.getProperty(instance, "someBoxedGlist")).toEqual([-2, 0, 5]);
        GObject.setProperty(instance, "someBoxedGlist", [9, -4]);
        expect(instance.someBoxedGlist).toEqual([9, -4]);
        expect(GObject.getProperty(instance, "someHashTable")).toEqual(new Map([[5, "five"]]));
        GObject.setProperty(instance, "someHashTable", null);
        expect(instance.someHashTable).toBeNull();
    },
);

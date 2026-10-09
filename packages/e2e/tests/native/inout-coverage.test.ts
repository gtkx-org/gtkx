import * as GIMarshallingTests from "@gtkx/gi/gimarshallingtests";
import * as GObject from "@gtkx/gi/gobject";
import * as Regress from "@gtkx/gi/regress";
import { expect, test } from "vitest";
import { drainGC } from "./helpers/memory.js";

test("string pointer replacement preserves borrowed input and owns transferred output", () => {
    expect(GIMarshallingTests.utf8NoneInout(GIMarshallingTests.CONSTANT_UTF8)).toBe("");
    expect(GIMarshallingTests.utf8FullInout(GIMarshallingTests.CONSTANT_UTF8)).toBe("");
    expect(Regress.testUtf8Inout(Regress.testUtf8ConstReturn())).toBe(Regress.testUtf8NonconstReturn());
});

test("fixed and length-bounded inout arrays return the replacement and updated extent", () => {
    const original = [-1, 0, 1, 2];
    expect(GIMarshallingTests.arrayFixedInout(original)).toEqual([2, 1, 0, -1]);
    expect(GIMarshallingTests.arrayInout(original)).toEqual([-2, -1, 0, 1, 2]);
    expect(GIMarshallingTests.arrayInoutEtc(7, original, 8)).toEqual([[7, -1, 0, 1, 8], 15]);
    expect(new GIMarshallingTests.Object({}).methodArrayInout(Int32Array.from(original))).toEqual([-2, -1, 0, 1, 2]);
    expect(original).toEqual([-1, 0, 1, 2]);
    expect(Regress.testArrayIntInout(original)).toEqual([1, 2, 3]);
    expect(Regress.testArrayIntInout([42])).toEqual([]);
});

test("string-vector aliases preserve their hidden pointer indirection", () => {
    expect(GIMarshallingTests.arrayZeroTerminatedInout(["0", "1", "2"])).toEqual(["-1", "0", "1", "2"]);
    expect(GIMarshallingTests.gstrvInout(["0", "1", "2"])).toEqual(["-1", "0", "1", "2"]);
    expect(GIMarshallingTests.gstrvOut()).toEqual(["0", "1", "2"]);
    expect(GIMarshallingTests.gstrvOutUninitialized()).toEqual([false, []]);
});

test.each([
    ["fixed borrowed", GIMarshallingTests.fixedArrayUtf8NoneInout],
    ["fixed container", GIMarshallingTests.fixedArrayUtf8ContainerInout],
    ["fixed full", GIMarshallingTests.fixedArrayUtf8FullInout],
    ["sized borrowed", GIMarshallingTests.lengthArrayUtf8NoneInout],
    ["sized container", GIMarshallingTests.lengthArrayUtf8ContainerInout],
    ["sized full", GIMarshallingTests.lengthArrayUtf8FullInout],
    ["terminated borrowed", GIMarshallingTests.zeroTerminatedArrayUtf8NoneInout],
    ["terminated container", GIMarshallingTests.zeroTerminatedArrayUtf8ContainerInout],
    ["terminated full", GIMarshallingTests.zeroTerminatedArrayUtf8FullInout],
] as const)("%s string-array inout replaces multibyte elements", (_name, replace) => {
    const original = ["🅰", "β", "c", "d"];
    expect(replace(original)).toEqual(["a", "b", "¢", "🔠"]);
    expect(original).toEqual(["🅰", "β", "c", "d"]);
});

test.each([
    ["GArray borrowed", GIMarshallingTests.garrayUtf8NoneInout],
    ["GArray container", GIMarshallingTests.garrayUtf8ContainerInout],
    ["GArray full", GIMarshallingTests.garrayUtf8FullInout],
    ["GPtrArray borrowed", GIMarshallingTests.gptrarrayUtf8NoneInout],
    ["GPtrArray container", GIMarshallingTests.gptrarrayUtf8ContainerInout],
    ["GPtrArray full", GIMarshallingTests.gptrarrayUtf8FullInout],
    ["GList borrowed", GIMarshallingTests.glistUtf8NoneInout],
    ["GList container", GIMarshallingTests.glistUtf8ContainerInout],
    ["GList full", GIMarshallingTests.glistUtf8FullInout],
    ["GSList borrowed", GIMarshallingTests.gslistUtf8NoneInout],
    ["GSList container", GIMarshallingTests.gslistUtf8ContainerInout],
    ["GSList full", GIMarshallingTests.gslistUtf8FullInout],
] as const)("%s inout replaces the native container", (_name, replace) => {
    const original = ["0", "1", "2"];
    expect(replace(original)).toEqual(["-2", "-1", "0", "1"]);
    expect(original).toEqual(["0", "1", "2"]);
});

test.each([
    ["borrowed", GIMarshallingTests.ghashtableUtf8NoneInout],
    ["container", GIMarshallingTests.ghashtableUtf8ContainerInout],
    ["full", GIMarshallingTests.ghashtableUtf8FullInout],
] as const)("%s hash-table inout returns replaced entries", (_name, replace) => {
    const original = new Map([
        ["-1", "1"],
        ["0", "0"],
        ["1", "-1"],
        ["2", "-2"],
    ]);
    expect(replace(original)).toEqual(
        new Map([
            ["-1", "1"],
            ["0", "0"],
            ["1", "1"],
        ]),
    );
    expect(original.get("1")).toBe("-1");
});

test("byte-array inout preserves embedded zeroes and byte values", () => {
    const original = Uint8Array.of(0, 49, 255, 51);
    expect(GIMarshallingTests.bytearrayFullInout(original)).toEqual(Uint8Array.of(104, 101, 108, 0, 255));
    expect(original).toEqual(Uint8Array.of(0, 49, 255, 51));
});

test("caller-allocated GArray output owns the populated elements and container", () => {
    expect(GIMarshallingTests.garrayUtf8FullOutCallerAllocated()).toEqual(["0", "1", "2"]);
});

test("handle replacement preserves the caller's objects and owns returned instances", async () => {
    const original = GIMarshallingTests.BoxedStruct.new();
    original.long = 42n;
    const replacement = GIMarshallingTests.BoxedStruct.inout(original);
    expect(replacement.long).toBe(0n);
    expect(original.long).toBe(42n);
    const object = new GIMarshallingTests.Object({ int: 42 });
    const borrowed = GIMarshallingTests.Object.noneInout(object);
    const owned = GIMarshallingTests.Object.fullInout(object);
    await drainGC();
    expect(object.int).toBe(42);
    expect(borrowed.int).toBe(0);
    expect(owned.int).toBe(0);
});

test("GValue double pointers expose native mutation through the returned value", () => {
    const original = new GObject.Value();
    original.init(GObject.typeFromName("gint"));
    original.setInt(42);
    const replacement = GIMarshallingTests.gvalueInout(original);
    expect(replacement.getString()).toBe("42");
    expect(original.getString()).toBe("42");
});

test("initialization APIs update argv while folding the changed argument count", () => {
    expect(GIMarshallingTests.initFunction(["gtkx", "--remove"])).toEqual([true, ["gtkx"]]);
    expect(GIMarshallingTests.initFunction([])).toEqual([true, []]);
    expect(GIMarshallingTests.initFunction(null)).toEqual([true, []]);
    expect(GIMarshallingTests.lengthArrayUtf8OptionalInout(["🅰", "β", "c", "d"])).toEqual(["a", "b", "¢", "🔠"]);
    expect(Regress.annotationInit(["gtkx", "--retain"])).toEqual(["gtkx", "--retain"]);
    expect(new Regress.AnnotationObject({}).parseArgs(["gtkx", "--retain"])).toEqual(["gtkx", "--retain"]);
    expect(Regress.annotationStringZeroTerminatedOut(["gtkx", "--retain"])).toEqual(["gtkx", "--retain"]);
    expect(Regress.fooInitArgvAddress(["gtkx"])).toEqual([Regress.FOO_SUCCESS_INT, ["gtkx"]]);
    expect(Regress.fooInitArgvAddress(null)).toEqual([Regress.FOO_SUCCESS_INT, []]);
});

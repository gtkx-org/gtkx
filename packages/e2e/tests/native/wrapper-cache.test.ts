import * as GObject from "@gtkx/gi/gobject";
import {
    type ExternalObject,
    getFundamentalWrapper,
    getWrapper,
    type Handle,
    newObject,
    setFundamentalWrapper,
    setWrapper,
} from "@gtkx/native";
import { getHandle } from "@gtkx/runtime";
import { expect, test } from "vitest";
import { drainAfterEachTest, drainGC } from "./helpers/memory.js";

drainAfterEachTest();

const fundamental = () => GObject.paramSpecBoolean("flag", "Flag", "a flag", false, GObject.ParamFlags.READWRITE);

test("a generated GObject exposes its cached wrapper", () => {
    const object = new GObject.Object();

    expect(getWrapper(getHandle(object))).toBe(object);
});

test("a generated native round trip finds a replacement GObject wrapper", () => {
    const object = new GObject.Object();
    const handle = getHandle(object);
    const value = new GObject.Value();
    value.init(GObject.TYPE_OBJECT);
    value.setObject(object);
    const wrapper = { handle };
    setWrapper(handle, wrapper);

    expect(value.getObject()).toBe(wrapper);
    setWrapper(handle, object);
});

test("a native object has no cached wrapper before its associator attaches one", () => {
    let created: ExternalObject<Handle> | undefined;
    newObject(GObject.TYPE_OBJECT, [], [], {}, (handle) => {
        created = handle;
    });
    if (created === undefined) {
        throw new Error("The object was not associated");
    }

    expect(getWrapper(created)).toBeNull();
});

test("attaching a second wrapper replaces a generated GObject wrapper", () => {
    const object = new GObject.Object();
    const handle = getHandle(object);
    const replacement = { handle };
    setWrapper(handle, replacement);

    expect(getWrapper(handle)).toBe(replacement);
    setWrapper(handle, object);
    expect(getWrapper(handle)).toBe(object);
});

test("a generated GObject does not fill the fundamental cache", () => {
    const object = new GObject.Object();
    const handle = getHandle(object);

    expect(getWrapper(handle)).toBe(object);
    expect(getFundamentalWrapper(handle)).toBeNull();
});

test("attaching a primitive as a generated object's wrapper throws", () => {
    const object = new GObject.Object();

    expect(() => {
        Reflect.apply(setWrapper, null, [getHandle(object), 42]);
    }).toThrow();
});

test("a generated ParamSpec exposes its cached fundamental wrapper", () => {
    const spec = fundamental();

    expect(getFundamentalWrapper(getHandle(spec))).toBe(spec);
});

test("a generated native round trip finds a replacement fundamental wrapper", () => {
    const spec = fundamental();
    const handle = getHandle(spec);
    const value = new GObject.Value();
    value.init(GObject.TYPE_PARAM);
    value.setParam(spec);
    const wrapper = { handle };
    setFundamentalWrapper(handle, wrapper);

    expect(value.getParam()).toBe(wrapper);
    setFundamentalWrapper(handle, spec);
});

test("a fundamental cache becomes empty when its replacement wrapper is collected", async () => {
    const spec = fundamental();
    const handle = getHandle(spec);
    setFundamentalWrapper(handle, {});
    await drainGC(5);

    expect(getFundamentalWrapper(handle)).toBeNull();
    expect(spec.getName()).toBe("flag");
});

test("a second fundamental wrapper replaces the first", () => {
    const spec = fundamental();
    const handle = getHandle(spec);
    const replacement = { handle };
    setFundamentalWrapper(handle, replacement);

    expect(getFundamentalWrapper(handle)).toBe(replacement);
    setFundamentalWrapper(handle, spec);
    expect(getFundamentalWrapper(handle)).toBe(spec);
});

test("a generated fundamental wrapper does not fill the object cache", () => {
    const spec = fundamental();
    const handle = getHandle(spec);

    expect(getFundamentalWrapper(handle)).toBe(spec);
    expect(getWrapper(handle)).toBeNull();
});

test("attaching a primitive as a fundamental wrapper throws", () => {
    const spec = fundamental();

    expect(() => {
        Reflect.apply(setFundamentalWrapper, null, [getHandle(spec), 42]);
    }).toThrow();
});

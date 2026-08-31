import {
    alloc,
    bind,
    call,
    type ExternalObject,
    getFundamentalWrapper,
    getWrapper,
    type Handle,
    init,
    keepAlive,
    newObject,
    resolveType,
    setFundamentalWrapper,
    setWrapper,
} from "@gtkx/native";
import { expect, test } from "vitest";

const GOBJECT = "libgobject-2.0.so.0";
const READWRITE = 3;

init();

const OBJECT_TYPE = resolveType(GOBJECT, "g_object_get_type");

const objectRef = bind(GOBJECT, "g_object_ref", [{ kind: "object", ownership: "borrowed" }], {
    kind: "object",
    ownership: "full",
});

const paramSpecNew = bind(
    GOBJECT,
    "g_param_spec_boolean",
    [
        { kind: "string", ownership: "borrowed" },
        { kind: "string", ownership: "borrowed" },
        { kind: "string", ownership: "borrowed" },
        { kind: "boolean" },
        { kind: "uint32" },
    ],
    {
        kind: "fundamental",
        ownership: "full",
        sharedLibrary: GOBJECT,
        refFnName: "g_param_spec_ref",
        unrefFnName: "g_param_spec_unref",
    },
);

const paramSpecRef = bind(
    GOBJECT,
    "g_param_spec_ref",
    [
        {
            kind: "fundamental",
            ownership: "borrowed",
            sharedLibrary: GOBJECT,
            refFnName: "g_param_spec_ref",
            unrefFnName: "g_param_spec_unref",
        },
    ],
    {
        kind: "fundamental",
        ownership: "full",
        sharedLibrary: GOBJECT,
        refFnName: "g_param_spec_ref",
        unrefFnName: "g_param_spec_unref",
    },
);

const objectHandle = (): ExternalObject<Handle> => {
    let created: ExternalObject<Handle> | undefined;

    newObject(OBJECT_TYPE, [], [], {}, (handle) => {
        created = handle;
    });

    if (created === undefined) {
        throw new Error("the associator was never called");
    }

    return created;
};

const fundamentalHandle = (): ExternalObject<Handle> =>
    call(paramSpecNew, ["flag", "Flag", "a flag", false, READWRITE]) as ExternalObject<Handle>;

const anotherObjectHandle = (handle: ExternalObject<Handle>): ExternalObject<Handle> =>
    call(objectRef, [handle]) as ExternalObject<Handle>;

const anotherFundamentalHandle = (handle: ExternalObject<Handle>): ExternalObject<Handle> =>
    call(paramSpecRef, [handle]) as ExternalObject<Handle>;

test("a wrapper attached to a GObject comes back as the same object", () => {
    const handle = objectHandle();
    const wrapper = { handle };

    setWrapper(handle, wrapper);

    expect(getWrapper(handle)).toBe(wrapper);
});

test("a wrapper attached to a GObject comes back through another handle over the same instance", () => {
    const handle = objectHandle();
    const alias = anotherObjectHandle(handle);
    const wrapper = { handle };

    setWrapper(handle, wrapper);

    expect(getWrapper(alias)).toBe(wrapper);
});

test("a GObject carries no wrapper until one is attached", () => {
    expect(getWrapper(objectHandle())).toBeNull();
});

test("attaching a second wrapper to a GObject replaces the first", () => {
    const handle = objectHandle();
    const first = { handle };
    const second = { handle };

    setWrapper(handle, first);
    setWrapper(handle, second);

    expect(getWrapper(handle)).toBe(second);
});

test("a plain allocation carries no object wrapper", () => {
    expect(getWrapper(alloc(16))).toBeNull();
});

test("a wrapper attached to a GObject does not fill its fundamental slot", () => {
    const handle = objectHandle();
    const wrapper = { handle };

    setWrapper(handle, wrapper);

    expect(getWrapper(handle)).toBe(wrapper);
    expect(getFundamentalWrapper(handle)).toBeNull();
});

test("attaching an object wrapper to a plain allocation throws", () => {
    expect(() => {
        setWrapper(alloc(16), {});
    }).toThrow();
});

test("reading an object wrapper from a value that is not a handle throws", () => {
    const notAHandle: unknown = {};

    expect(() => getWrapper(notAHandle as ExternalObject<Handle>)).toThrow();
});

test("attaching an object wrapper to a value that is not a handle throws", () => {
    const notAHandle: unknown = {};

    expect(() => {
        setWrapper(notAHandle as ExternalObject<Handle>, {});
    }).toThrow();
});

test("attaching a primitive as an object wrapper throws", () => {
    const notAnObject: unknown = 42;

    expect(() => {
        setWrapper(objectHandle(), notAnObject as object);
    }).toThrow();
});

test("a wrapper cached for a fundamental instance comes back as the same object", () => {
    const handle = fundamentalHandle();
    const wrapper = { handle };

    setFundamentalWrapper(handle, wrapper);

    expect(getFundamentalWrapper(handle)).toBe(wrapper);
});

test("a wrapper cached for a fundamental instance comes back through another handle over it", () => {
    const handle = fundamentalHandle();
    const wrapper = { handle };

    setFundamentalWrapper(handle, wrapper);

    expect(getFundamentalWrapper(anotherFundamentalHandle(handle))).toBe(wrapper);
});

test("a fundamental instance carries no wrapper until one is cached", () => {
    expect(getFundamentalWrapper(fundamentalHandle())).toBeNull();
});

test("caching a second wrapper for a fundamental instance replaces the first", () => {
    const handle = fundamentalHandle();
    const first = { handle };
    const second = { handle };

    setFundamentalWrapper(handle, first);
    setFundamentalWrapper(handle, second);

    expect(getFundamentalWrapper(handle)).toBe(second);
});

test("caching a fundamental wrapper on a plain allocation leaves nothing cached", () => {
    const handle = alloc(16);

    setFundamentalWrapper(handle, { handle });

    expect(getFundamentalWrapper(handle)).toBeNull();
});

test("a wrapper cached for a fundamental instance does not fill its object slot", () => {
    const handle = fundamentalHandle();
    const wrapper = { handle };

    setFundamentalWrapper(handle, wrapper);

    expect(getFundamentalWrapper(handle)).toBe(wrapper);
    expect(getWrapper(handle)).toBeNull();
});

test("reading a fundamental wrapper from a value that is not a handle throws", () => {
    const notAHandle: unknown = {};

    expect(() => getFundamentalWrapper(notAHandle as ExternalObject<Handle>)).toThrow();
});

test("caching a fundamental wrapper on a value that is not a handle throws", () => {
    const notAHandle: unknown = {};

    expect(() => {
        setFundamentalWrapper(notAHandle as ExternalObject<Handle>, {});
    }).toThrow();
});

test("caching a primitive as a fundamental wrapper throws", () => {
    const notAnObject: unknown = 42;

    expect(() => {
        setFundamentalWrapper(fundamentalHandle(), notAnObject as object);
    }).toThrow();
});

test("the event loop keep-alive accepts alternating and repeated states", () => {
    expect(() => {
        keepAlive(true);
        keepAlive(true);
        keepAlive(false);
        keepAlive(false);
    }).not.toThrow();
});

test("a non-boolean event loop keep-alive state throws", () => {
    const notABoolean: unknown = "yes";

    expect(() => {
        keepAlive(notABoolean as boolean);
    }).toThrow();
});

test("an event loop keep-alive state left out throws", () => {
    expect(() => {
        (keepAlive as () => void)();
    }).toThrow();
});

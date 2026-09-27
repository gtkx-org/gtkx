import {
    alloc,
    type ExternalObject,
    getFundamentalWrapper,
    getWrapper,
    type Handle,
    setFundamentalWrapper,
    setWrapper,
} from "@gtkx/native";
import { expect, test } from "vitest";

test("a plain allocation carries no object wrapper", () => {
    expect(getWrapper(alloc(16))).toBeNull();
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

test("caching a fundamental wrapper on a plain allocation leaves nothing cached", () => {
    const handle = alloc(16);

    setFundamentalWrapper(handle, { handle });

    expect(getFundamentalWrapper(handle)).toBeNull();
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

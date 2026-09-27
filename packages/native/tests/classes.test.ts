import { newObject, registerClass } from "@gtkx/native";
import { expect, test } from "vitest";

const registrations = { count: 0 };
const uniqueName = () => `GtkxNativeInvalidClass${String(registrations.count++)}`;
const ignore = (): void => undefined;

test("registering with the invalid GType as a parent throws", () => {
    expect(() => registerClass(uniqueName(), 0n)).toThrow();
});

test("constructing the invalid GType throws", () => {
    expect(() => newObject(0n, [], [], {}, ignore)).toThrow();
});

test("registering under a parent GType that names no registered type throws", () => {
    expect(() => registerClass(uniqueName(), 100n)).toThrow();
});

test("constructing a GType that names no registered type throws", () => {
    expect(() => newObject(100n, [], [], {}, ignore)).toThrow();
});

import { keepAlive } from "@gtkx/native";
import { expect, test } from "vitest";

test("toggling the keep alive without an argument throws", () => {
    expect(() => {
        (keepAlive as () => void)();
    }).toThrow();
});

test("toggling the keep alive with a non-boolean argument throws", () => {
    expect(() => {
        (keepAlive as (enable: unknown) => void)("on");
    }).toThrow();
});

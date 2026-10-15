import { bindFunction, call, createFunction, openLibrary, resolveSymbol } from "@gtkx/native";
import { expect, test } from "vitest";

test("one function signature calls both a library symbol and an owned JavaScript callback", () => {
    const signature = bindFunction([{ kind: "int32" }], { kind: "int32" }, "integer operation", { argOrder: [0] });
    const absolute = resolveSymbol(openLibrary("libc.so.6"), "abs", false);
    if (absolute == null) throw new Error("Missing libc abs");
    const triple = createFunction(signature, (value: number) => value * 3, { kind: "pointer" });

    expect(call(signature, absolute, [-7]).value).toBe(7);
    expect(call(signature, triple, [7]).value).toBe(21);
    expect(call(signature, absolute, [-9]).value).toBe(9);
    expect(call(signature, triple, [-9]).value).toBe(-27);
});

test("a shared callback signature preserves reordered integer and floating arguments", () => {
    const signature = bindFunction(
        [{ kind: "int32" }, { kind: "float64" }],
        { kind: "float64" },
        "reordered callback",
        { argOrder: [1, 0] },
    );
    const subtract = createFunction(signature, (integer: number, fraction: number) => integer - fraction, {
        kind: "pointer",
    });

    expect(call(signature, subtract, [5, 0.75]).value).toBe(4.25);
});

test("calling a callback signature with an implicit error argument is rejected", () => {
    const signature = bindFunction(
        [{ kind: "int32" }],
        { kind: "int32" },
        "throwing callback",
        { argOrder: [0] },
        { canThrow: true },
    );
    const callback = createFunction(signature, (value: number) => value, { kind: "pointer" });

    expect(() => call(signature, callback, [17])).toThrow(/implicit error argument/);
});

test("variadic call signatures cannot create native callback trampolines", () => {
    const signature = bindFunction([{ kind: "int32" }, { kind: "float64" }], { kind: "void" }, "variadic callback", {
        argOrder: [0, 1],
        fixedArgCount: 1,
    });

    expect(() => createFunction(signature, () => undefined, { kind: "pointer" })).toThrow(/variadic/);
});

test.each([
    { kind: "object", ownership: "borrowed", isCallScoped: false, typeResolver: 17 },
    {
        kind: "struct",
        ownership: "full",
        isCallerAllocated: false,
        isInline: false,
        isValueSafe: false,
        freeResolver: "g_free",
    },
])("rejects a non-callable $kind lifecycle resolver during signature binding", (descriptor) => {
    expect(() => {
        Reflect.apply(bindFunction, undefined, [[], descriptor, "invalid resolver", { argOrder: [] }]);
    }).toThrow(/lifecycle resolver must be a function/);
});

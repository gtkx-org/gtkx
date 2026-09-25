import * as runtime from "@gtkx/runtime";
import { expect, expectTypeOf, test } from "vitest";

test("the public runtime entry point excludes generated retention machinery", () => {
    expect(runtime).not.toHaveProperty("retainWrapperClasses");
    expectTypeOf<typeof runtime>().not.toHaveProperty("retainWrapperClasses");
});

test("the public runtime entry point retains binding registration", () => {
    expect(runtime.registerConstructProperties).toBeTypeOf("function");
    expect(runtime.registerClassStruct).toBeTypeOf("function");
    expect(runtime.installInterfaces).toBeTypeOf("function");
});

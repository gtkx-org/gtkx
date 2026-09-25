import * as native from "@gtkx/native";
import { armParentDeath } from "@gtkx/native/internal";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { expect, expectTypeOf, test } from "vitest";

const internalExports = ["armParentDeath", "addLogListener", "removeLogListener", "__napiBindingTarget"];

test("the public entry point retains native memory access", () => {
    const field: native.Descriptor = { kind: "int32" };
    const handle: native.ExternalObject<native.Handle> = native.alloc(4);
    native.write(handle, field, 0, 42);

    expect(native.read(handle, field, 0)).toBe(42);
});

test("parent supervision remains available through the internal entry point", () => {
    expect(armParentDeath).toBeTypeOf("function");
    expectTypeOf(armParentDeath).parameter(0).toEqualTypeOf<number>();
});

test.each(internalExports)("the public entry point excludes %s", (name) => {
    expect(native).not.toHaveProperty(name);

    const result = spawnSync(process.execPath, [
        "--input-type=module",
        "--eval",
        `import { ${name} } from "@gtkx/native";`,
    ], { cwd: fileURLToPath(new URL("..", import.meta.url)), encoding: "utf8" });

    expect(result.status).toBe(1);
});

test("consumer declarations expose subscriptions and exclude addon internals", () => {
    expectTypeOf<native.LogSubscription>().toHaveProperty("unsubscribe");
    expectTypeOf(native.onLog).returns.toEqualTypeOf<native.LogSubscription>();
    expectTypeOf<typeof native>().not.toHaveProperty("armParentDeath");
    expectTypeOf<typeof native>().not.toHaveProperty("addLogListener");
    expectTypeOf<typeof native>().not.toHaveProperty("removeLogListener");
    expectTypeOf<typeof native>().not.toHaveProperty("__napiBindingTarget");
});

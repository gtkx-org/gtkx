import { execFileSync } from "node:child_process";
import { dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { quit } from "@gtkx/ffi";
import { afterAll, beforeAll } from "vitest";
import { callArgs, GTK_LIB } from "./helpers/native-utils.js";

const fixturesDir = dirname(fileURLToPath(new URL("./fixtures/com.gtkx.test.useSetting.gschema.xml", import.meta.url)));
execFileSync("glib-compile-schemas", [fixturesDir], { stdio: "ignore" });

const existing = process.env["GSETTINGS_SCHEMA_DIR"];
process.env["GSETTINGS_SCHEMA_DIR"] = existing ? `${fixturesDir}:${existing}` : fixturesDir;
process.env["GSETTINGS_BACKEND"] = "memory";

const collectGarbage = (): void => {
    if (global.gc) global.gc();
};

const callRunnerHook = (name: "afterEach" | "afterAll", callback: () => unknown): void => {
    const hook: unknown = Reflect.get(globalThis, name);
    if (typeof hook === "function") (hook as (callback: () => unknown) => void)(callback);
};

callRunnerHook("afterEach", collectGarbage);
callRunnerHook("afterAll", quit);

let previousIsReactActEnvironment: boolean | undefined;

beforeAll(async () => {
    callArgs(GTK_LIB, "gtk_init", [], { kind: "void" });
    const { getIsReactActEnvironment, setIsReactActEnvironment } = await import("@gtkx/testing/act");
    previousIsReactActEnvironment = getIsReactActEnvironment();
    setIsReactActEnvironment(true);
});

afterAll(async () => {
    const { setIsReactActEnvironment } = await import("@gtkx/testing/act");
    setIsReactActEnvironment(previousIsReactActEnvironment);
});

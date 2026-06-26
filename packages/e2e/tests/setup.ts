import { execFileSync } from "node:child_process";
import { dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { afterAll, afterEach, beforeAll } from "vitest";

const fixturesDir = dirname(fileURLToPath(new URL("./fixtures/com.gtkx.test.useSetting.gschema.xml", import.meta.url)));
execFileSync("glib-compile-schemas", [fixturesDir], { stdio: "ignore" });

const existing = process.env["GSETTINGS_SCHEMA_DIR"];
process.env["GSETTINGS_SCHEMA_DIR"] = existing ? `${fixturesDir}:${existing}` : fixturesDir;
process.env["GSETTINGS_BACKEND"] = "memory";

const runCleanup = async (): Promise<void> => {
    const { cleanup } = await import("@gtkx/testing");
    await cleanup();
};

let previousIsReactActEnvironment: boolean | undefined;

beforeAll(async () => {
    const { getIsReactActEnvironment, setIsReactActEnvironment } = await import("@gtkx/testing/act");
    previousIsReactActEnvironment = getIsReactActEnvironment();
    setIsReactActEnvironment(true);
});

afterAll(async () => {
    const { setIsReactActEnvironment } = await import("@gtkx/testing/act");
    setIsReactActEnvironment(previousIsReactActEnvironment);
});

afterEach(runCleanup);
afterAll(runCleanup);

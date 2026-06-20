import { execFileSync } from "node:child_process";
import { dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { afterAll, afterEach } from "vitest";

const fixturesDir = dirname(fileURLToPath(new URL("./fixtures/com.gtkx.test.useSetting.gschema.xml", import.meta.url)));
execFileSync("glib-compile-schemas", [fixturesDir], { stdio: "ignore" });

const existing = process.env["GSETTINGS_SCHEMA_DIR"];
process.env["GSETTINGS_SCHEMA_DIR"] = existing ? `${fixturesDir}:${existing}` : fixturesDir;
process.env["GSETTINGS_BACKEND"] = "memory";

const runCleanup = async (): Promise<void> => {
    const { cleanup } = await import("@gtkx/testing");
    await cleanup();
};

afterEach(runCleanup);
afterAll(runCleanup);

import { execFileSync } from "node:child_process";
import { dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { afterAll, afterEach } from "vitest";

const fixturesDir = dirname(fileURLToPath(new URL("./fixtures/com.gtkx.test.useSetting.gschema.xml", import.meta.url)));
execFileSync("glib-compile-schemas", [fixturesDir], { stdio: "ignore" });

const existing = process.env.GSETTINGS_SCHEMA_DIR;
process.env.GSETTINGS_SCHEMA_DIR = existing ? `${fixturesDir}:${existing}` : fixturesDir;
process.env.GSETTINGS_BACKEND = "memory";

/**
 * `@gtkx/testing` transitively imports `@gtkx/ffi`, whose module evaluation
 * runs `gtk_init()`. Importing it inside the hooks — which run after the
 * `@gtkx/vitest` worker setup has brought up Xvfb — keeps a display-less
 * `gtk_init()` from aborting the worker while setup files load.
 */
const runCleanup = async (): Promise<void> => {
    const { cleanup } = await import("@gtkx/testing");
    await cleanup();
};

afterEach(runCleanup);
afterAll(runCleanup);

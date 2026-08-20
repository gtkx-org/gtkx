import { resolveExecutable } from "@gtkx/utils";
import { execFileSync } from "node:child_process";
import { dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, beforeAll } from "vitest";
import { callArgs, GTK_LIB } from "./helpers/native-utils.js";

const fixturesDir = dirname(fileURLToPath(new URL("fixtures/com.gtkx.test.useSetting.gschema.xml", import.meta.url)));
const existingSchemaDir = process.env.GSETTINGS_SCHEMA_DIR;

const collectGarbage = (): void => {
    if (globalThis.gc) {
        globalThis.gc();
    }
};

execFileSync(resolveExecutable("glib-compile-schemas"), [fixturesDir], { stdio: "ignore" });
process.env.GSETTINGS_SCHEMA_DIR = existingSchemaDir ? `${fixturesDir}:${existingSchemaDir}` : fixturesDir;
process.env.GSETTINGS_BACKEND = "memory";
afterEach(collectGarbage);

beforeAll(() => {
    callArgs(GTK_LIB, "gtk_init", [], { kind: "void" });
});

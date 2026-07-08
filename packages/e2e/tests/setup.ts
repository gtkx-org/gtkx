import { execFileSync } from "node:child_process";
import { dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { afterAll, afterEach, beforeAll } from "vitest";
import { callArgs, GTK_LIB } from "./helpers/native-utils.js";

const fixturesDir = dirname(fileURLToPath(new URL("./fixtures/com.gtkx.test.useSetting.gschema.xml", import.meta.url)));
execFileSync("glib-compile-schemas", [fixturesDir], { stdio: "ignore" });

const existing = process.env.GSETTINGS_SCHEMA_DIR;
process.env.GSETTINGS_SCHEMA_DIR = existing ? `${fixturesDir}:${existing}` : fixturesDir;
process.env.GSETTINGS_BACKEND = "memory";

const collectGarbage = (): void => {
    if (global.gc) global.gc();
};

afterEach(collectGarbage);

declare global {
    var IS_REACT_ACT_ENVIRONMENT: boolean | undefined;
}

let previousIsReactActEnvironment: boolean | undefined;

beforeAll(() => {
    callArgs(GTK_LIB, "gtk_init", [], { kind: "void" });
    previousIsReactActEnvironment = globalThis.IS_REACT_ACT_ENVIRONMENT;
    globalThis.IS_REACT_ACT_ENVIRONMENT = true;
});

afterAll(() => {
    globalThis.IS_REACT_ACT_ENVIRONMENT = previousIsReactActEnvironment;
});

import { resolveExecutable } from "@gtkx/utils";
import { execFileSync } from "node:child_process";
import { dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { afterAll, afterEach, beforeAll } from "vitest";
import { callArgs, GTK_LIB } from "./helpers/native-utils.js";

declare global {
    var IS_REACT_ACT_ENVIRONMENT: boolean | undefined;
}

const fixturesDir = dirname(fileURLToPath(new URL("fixtures/com.gtkx.test.useSetting.gschema.xml", import.meta.url)));
const existingSchemaDir = process.env.GSETTINGS_SCHEMA_DIR;

const collectGarbage = (): void => {
    if (globalThis.gc) {
        globalThis.gc();
    }
};

const setIsReactActEnvironment = (value: boolean | undefined): void => {
    Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: value });
};

const registerReactActEnvironment = (): void => {
    let wasReactActEnvironment: boolean | undefined;

    beforeAll(() => {
        callArgs(GTK_LIB, "gtk_init", [], { kind: "void" });
        wasReactActEnvironment = globalThis.IS_REACT_ACT_ENVIRONMENT;
        setIsReactActEnvironment(true);
    });

    afterAll(() => {
        setIsReactActEnvironment(wasReactActEnvironment);
    });
};

execFileSync(resolveExecutable("glib-compile-schemas"), [fixturesDir], { stdio: "ignore" });
process.env.GSETTINGS_SCHEMA_DIR = existingSchemaDir ? `${fixturesDir}:${existingSchemaDir}` : fixturesDir;
process.env.GSETTINGS_BACKEND = "memory";
afterEach(collectGarbage);
registerReactActEnvironment();

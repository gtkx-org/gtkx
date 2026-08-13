import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { type AppProbe, probeAppProject, removeAppProject } from "./app-project.js";

const BUILD_TIMEOUT = 120_000;
const OUT_DIR = "dist";
const CLASS_PREFIX = "class-name=";
const FUNCTION_PREFIX = "function-name=";
const REGISTERED_PREFIX = "registered-name=";
const CLASS_NAME = "ProbeCounter";
const SUBCLASS_NAME = "ProbeGauge";
const FUNCTION_NAME = "probeFactory";
const DERIVE_FAILURE = "cannot derive a name";
const REGISTRY_MODULE = "probe-registry.mjs";
const REGISTRY_SOURCE_PATH = join("src", REGISTRY_MODULE);

const REGISTRY_MODULE_SOURCE = String.raw`const registerClass = (klass) => {
    const name = klass.name;

    if (!name) {
        throw new Error("${DERIVE_FAILURE}");
    }

    process.stdout.write("${REGISTERED_PREFIX}" + name + "\n");
};

export { registerClass };
`;

const APP_ENTRY = String.raw`import { registerClass } from "./${REGISTRY_MODULE}";

class ${CLASS_NAME} {}

function ${FUNCTION_NAME}() {
    return 1;
}

process.stdout.write("${CLASS_PREFIX}" + ${CLASS_NAME}.name + "\n");
process.stdout.write("${FUNCTION_PREFIX}" + ${FUNCTION_NAME}.name + "\n");

class ${SUBCLASS_NAME} extends ${CLASS_NAME} {}

registerClass(${SUBCLASS_NAME});
`;

const printedName = (prefix: string, name: string): string => prefix + name + "\n";

describe("gtkx build (identifier names)", () => {
    let probe: AppProbe;

    beforeAll(async () => {
        probe = await probeAppProject({
            applicationId: "com.gtkx.clikeepnamesprobe",
            entry: APP_ENTRY,
            files: { [REGISTRY_SOURCE_PATH]: REGISTRY_MODULE_SOURCE },
            outDir: OUT_DIR,
            packageType: "module",
            prefix: "gtkx-bundle-keep-names-",
        });
    }, BUILD_TIMEOUT);

    afterAll(() => {
        removeAppProject(probe.project);
    });

    it("runs the emitted bundle without failing to derive a name", () => {
        expect(probe.run.stderr).toBe("");
        expect(probe.run.status).toBe(0);
    });

    it("keeps the declared class name in the emitted bundle", () => {
        expect(probe.run.stdout).toContain(printedName(CLASS_PREFIX, CLASS_NAME));
    });

    it("keeps the declared function name in the emitted bundle", () => {
        expect(probe.run.stdout).toContain(printedName(FUNCTION_PREFIX, FUNCTION_NAME));
    });

    it("keeps the name of a class the bundler inlines into the call that reads it", () => {
        expect(probe.run.stdout).toContain(printedName(REGISTERED_PREFIX, SUBCLASS_NAME));
    });
});

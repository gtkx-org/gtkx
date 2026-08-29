import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { type AppProbe, probeAppProject, removeAppProject } from "./app-project.js";

const BUILD_TIMEOUT = 120_000;
const OUT_DIR = "dist";
const CLASS_PREFIX = "class-name=";
const FUNCTION_PREFIX = "function-name=";
const REGISTERED_PREFIX = "registered-name=";
const WORKER_PREFIX = "worker-name=";
const CLASS_NAME = "ProbeCounter";
const SUBCLASS_NAME = "ProbeGauge";
const WORKER_CLASS_NAME = "ProbeIndexer";
const FUNCTION_NAME = "probeFactory";
const DERIVE_FAILURE = "cannot derive a name";
const REGISTRY_MODULE = "probe-registry.mjs";
const WORKER_MODULE = "probe-worker.mjs";
const REGISTRY_SOURCE_PATH = join("src", REGISTRY_MODULE);
const WORKER_SOURCE_PATH = join("src", WORKER_MODULE);

const REGISTRY_MODULE_SOURCE = `const registerClass = (klass, report) => {
    const name = klass.name;

    if (!name) {
        throw new Error("${DERIVE_FAILURE}");
    }

    report(name);
};

export { registerClass };
`;

const WORKER_MODULE_SOURCE = `import { parentPort } from "node:worker_threads";
import { registerClass } from "./${REGISTRY_MODULE}";

class ${WORKER_CLASS_NAME} {}

registerClass(${WORKER_CLASS_NAME}, (name) => parentPort?.postMessage(name));
`;

const APP_ENTRY = String.raw`import { Worker } from "node:worker_threads";
import { registerClass } from "./${REGISTRY_MODULE}";

class ${CLASS_NAME} {}

function ${FUNCTION_NAME}() {
    return 1;
}

process.stdout.write("${CLASS_PREFIX}" + ${CLASS_NAME}.name + "\n");
process.stdout.write("${FUNCTION_PREFIX}" + ${FUNCTION_NAME}.name + "\n");

class ${SUBCLASS_NAME} extends ${CLASS_NAME} {}

registerClass(${SUBCLASS_NAME}, (name) => process.stdout.write("${REGISTERED_PREFIX}" + name + "\n"));

const worker = new Worker(new URL("./${WORKER_MODULE}", import.meta.url));

worker.on("message", (message) => {
    process.stdout.write("${WORKER_PREFIX}" + message + "\n");
});

worker.on("error", (error) => {
    process.stderr.write(error.message + "\n");
    process.exitCode = 1;
});
`;

const printedName = (prefix: string, name: string): string => prefix + name + "\n";

describe("gtkx build (identifier names)", () => {
    let probe: AppProbe;

    beforeAll(async () => {
        probe = await probeAppProject({
            applicationId: "com.gtkx.clikeepnamesprobe",
            entry: APP_ENTRY,
            files: {
                [REGISTRY_SOURCE_PATH]: REGISTRY_MODULE_SOURCE,
                [WORKER_SOURCE_PATH]: WORKER_MODULE_SOURCE,
            },
            outDir: OUT_DIR,
            prefix: "gtkx-bundle-keep-names-",
        });
    }, BUILD_TIMEOUT);

    afterAll(() => {
        removeAppProject(probe.project);
    });

    it("keeps every declared name the emitted bundle reads back", () => {
        expect(probe.run.stderr).toBe("");
        expect(probe.run.status).toBe(0);
        expect(probe.run.stdout).toContain(printedName(CLASS_PREFIX, CLASS_NAME));
        expect(probe.run.stdout).toContain(printedName(FUNCTION_PREFIX, FUNCTION_NAME));
        expect(probe.run.stdout).toContain(printedName(REGISTERED_PREFIX, SUBCLASS_NAME));
        expect(probe.run.stdout).toContain(printedName(WORKER_PREFIX, WORKER_CLASS_NAME));
    });
});

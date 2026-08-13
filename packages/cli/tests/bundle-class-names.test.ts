import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { type AppProbe, probeAppProject, removeAppProject } from "./app-project.js";

const BUILD_TIMEOUT = 120_000;
const OUT_DIR = "dist";
const CLASS_PREFIX = "class-name=";
const SUBCLASS_PREFIX = "subclass-name=";
const FUNCTION_PREFIX = "function-name=";
const CLASS_NAME = "ProbeCounter";
const SUBCLASS_NAME = "ProbeGauge";
const FUNCTION_NAME = "probeFactory";

const APP_ENTRY = String.raw`const describeName = (value) => value.name;

class ${CLASS_NAME} {}

class ${SUBCLASS_NAME} extends ${CLASS_NAME} {}

function ${FUNCTION_NAME}() {
    return 1;
}

process.stdout.write("${CLASS_PREFIX}" + describeName(${CLASS_NAME}) + "\n");
process.stdout.write("${SUBCLASS_PREFIX}" + describeName(${SUBCLASS_NAME}) + "\n");
process.stdout.write("${FUNCTION_PREFIX}" + describeName(${FUNCTION_NAME}) + "\n");
`;

describe("gtkx build (identifier names)", () => {
    let probe: AppProbe;

    beforeAll(async () => {
        probe = await probeAppProject({
            applicationId: "com.gtkx.clikeepnamesprobe",
            entry: APP_ENTRY,
            outDir: OUT_DIR,
            packageType: "module",
            prefix: "gtkx-bundle-keep-names-",
        });
    }, BUILD_TIMEOUT);

    afterAll(() => {
        removeAppProject(probe.project);
    });

    it("runs the emitted bundle", () => {
        expect(probe.run.stderr).toBe("");
        expect(probe.run.status).toBe(0);
    });

    it("keeps the declared class name in the emitted bundle", () => {
        expect(probe.run.stdout).toContain(CLASS_PREFIX + CLASS_NAME);
    });

    it("keeps the name of a class that the bundler inlines into its only use", () => {
        expect(probe.run.stdout).toContain(SUBCLASS_PREFIX + SUBCLASS_NAME);
    });

    it("keeps the declared function name in the emitted bundle", () => {
        expect(probe.run.stdout).toContain(FUNCTION_PREFIX + FUNCTION_NAME);
    });
});

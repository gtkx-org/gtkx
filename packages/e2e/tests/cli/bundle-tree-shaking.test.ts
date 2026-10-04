import { readFileSync } from "node:fs";
import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
    type AppProbe,
    buildAppProject,
    createAppProject,
    probeAppProject,
    removeAppProject,
} from "./app-project.js";

const BUILD_TIMEOUT = 120_000;
const OUT_DIR = "dist";
const USED_NAME_PREFIX = "used-name=";
const USED_TYPE_PREFIX = "used-type=";
const DROPPED_TYPE_PREFIX = "dropped-type=";
const RETAINED_VALUES_PREFIX = "retained-values=";
const UNUSED_CLASS_METHOD = "getAutoplay";
const UNUSED_GET_TYPE = "gtk_video_get_type";

const APP_CONFIG = `export default {
    applicationId: "com.gtkx.clitreeshakingprobe",
    codegen: false,
};
`;

const APP_ENTRY = String.raw`import { File, IOErrorEnum, ioErrorQuark, SimpleAction, Task } from "@gtkx/gi/gio";
import { toVariant, typeFromName } from "@gtkx/runtime";

process.stdout.write("${USED_NAME_PREFIX}" + Task.name + "\n");
process.stdout.write("${USED_TYPE_PREFIX}" + String(typeFromName("GTask") !== 0n) + "\n");
process.stdout.write("${DROPPED_TYPE_PREFIX}" + String(typeFromName("GtkVideo") !== 0n) + "\n");

const retainedValues = ["retained", ""].map((value) => {
    const action = SimpleAction.newStateful("state", null, toVariant("s", value));
    const state = action.getState();

    if (state === null) {
        throw new Error("The action has no state");
    }

    return state.getString()[0];
});
process.stdout.write("${RETAINED_VALUES_PREFIX}" + JSON.stringify(retainedValues) + "\n");

let rejectedMissingFile = false;
try {
    File.newForPath(import.meta.dirname + "/gtkx-missing-file").read(null);
} catch (error) {
    rejectedMissingFile = error.matches(ioErrorQuark(), IOErrorEnum.NOT_FOUND);
}
if (!rejectedMissingFile) {
    process.exitCode = 1;
}
`;

const USED_SIGNAL_HANDLER = "onClicked";
const UNUSED_SIGNAL_HANDLER = "onActivateLink";

const REACT_APP_ENTRY = String.raw`import { GtkButton } from "@gtkx/jsx/gtk";

process.stdout.write("used-component=" + typeof GtkButton + "\n");
`;

describe("gtkx build (tree shaking)", () => {
    const cleanup = new DisposableStack();
    let probe: AppProbe;
    let bundle: string;

    beforeAll(async () => {
        probe = await probeAppProject({
            applicationId: "com.gtkx.clitreeshakingprobe",
            entry: APP_ENTRY,
            files: { "gtkx.config.mjs": APP_CONFIG },
            outDir: OUT_DIR,
            prefix: "gtkx-bundle-tree-shaking-",
        });

        cleanup.defer(() => {
            removeAppProject(probe.project);
        });
        bundle = readFileSync(join(probe.project.root, probe.reported), "utf8");
    }, BUILD_TIMEOUT);

    afterAll(() => {
        cleanup.dispose();
    });

    it("registers the classes the app imports", () => {
        expect(probe.run.status).toBe(0);
        expect(probe.run.stdout).toContain(`${USED_NAME_PREFIX}Task\n`);
        expect(probe.run.stdout).toContain(`${USED_TYPE_PREFIX}true\n`);
    });

    it("leaves a dropped class's type name unregistered", () => {
        expect(probe.run.stdout).toContain(`${DROPPED_TYPE_PREFIX}false\n`);
    });

    it("drops the namespaces the app never imports", () => {
        expect(bundle).not.toContain(UNUSED_CLASS_METHOD);
        expect(bundle).not.toContain(UNUSED_GET_TYPE);
    });

    it("retains native value wrappers without direct class imports", () => {
        expect(probe.run.status).toBe(0);
        expect(probe.run.stdout).toContain(`${RETAINED_VALUES_PREFIX}["retained",""]\n`);
    });

    it("retains native errors without a direct error class import", () => {
        expect(probe.run.status).toBe(0);
    });
});

describe("gtkx build (metadata tree shaking)", () => {
    const cleanup = new DisposableStack();
    let bundle: string;

    beforeAll(async () => {
        const project = createAppProject({
            applicationId: "com.gtkx.climetadataprobe",
            entry: REACT_APP_ENTRY,
            files: { "gtkx.config.mjs": APP_CONFIG },
            prefix: "gtkx-bundle-metadata-",
        });

        cleanup.defer(() => {
            removeAppProject(project);
        });
        const reported = await buildAppProject({ project, outDir: OUT_DIR });
        bundle = readFileSync(join(project.root, reported), "utf8");
    }, BUILD_TIMEOUT);

    afterAll(() => {
        cleanup.dispose();
    });

    it("keeps the metadata of the elements the app imports", () => {
        expect(bundle).toContain(USED_SIGNAL_HANDLER);
    });

    it("drops the metadata of elements the app never imports", () => {
        expect(bundle).not.toContain(UNUSED_SIGNAL_HANDLER);
    });
});

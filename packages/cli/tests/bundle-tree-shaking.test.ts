import { readFileSync } from "node:fs";
import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
    type AppProbe,
    type AppProject,
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
const UNUSED_CLASS_METHOD = "getAutoplay";
const UNUSED_GET_TYPE = "gtk_video_get_type";

const APP_CONFIG = `export default {
    applicationId: "com.gtkx.clitreeshakingprobe",
    codegen: false,
};
`;

const APP_ENTRY = String.raw`import { Task } from "@gtkx/gi/gio";
import { typeFromName } from "@gtkx/runtime";

process.stdout.write("${USED_NAME_PREFIX}" + Task.name + "\n");
process.stdout.write("${USED_TYPE_PREFIX}" + String(typeFromName("GTask") !== 0n) + "\n");
process.stdout.write("${DROPPED_TYPE_PREFIX}" + String(typeFromName("GtkVideo") !== 0n) + "\n");
`;

const USED_SIGNAL_HANDLER = "onClicked";
const UNUSED_SIGNAL_HANDLER = "onActivateLink";

const REACT_APP_ENTRY = String.raw`import { GtkButton } from "@gtkx/jsx";

process.stdout.write("used-component=" + typeof GtkButton + "\n");
`;

describe("gtkx build (tree shaking)", () => {
    let probe: AppProbe;
    let bundle: string;

    beforeAll(async () => {
        probe = await probeAppProject({
            applicationId: "com.gtkx.clitreeshakingprobe",
            entry: APP_ENTRY,
            files: { "gtkx.config.mjs": APP_CONFIG },
            outDir: OUT_DIR,
            packageType: "module",
            prefix: "gtkx-bundle-tree-shaking-",
        });

        bundle = readFileSync(join(probe.project.root, probe.reported), "utf8");
    }, BUILD_TIMEOUT);

    afterAll(() => {
        removeAppProject(probe.project);
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
});

describe("gtkx build (metadata tree shaking)", () => {
    let project: AppProject;
    let bundle: string;

    beforeAll(async () => {
        project = createAppProject({
            applicationId: "com.gtkx.climetadataprobe",
            entry: REACT_APP_ENTRY,
            files: { "gtkx.config.mjs": APP_CONFIG },
            packageType: "module",
            prefix: "gtkx-bundle-metadata-",
        });

        const reported = await buildAppProject({ project, outDir: OUT_DIR });
        bundle = readFileSync(join(project.root, reported), "utf8");
    }, BUILD_TIMEOUT);

    afterAll(() => {
        removeAppProject(project);
    });

    it("keeps the metadata of the elements the app imports", () => {
        expect(bundle).toContain(USED_SIGNAL_HANDLER);
    });

    it("drops the metadata of elements the app never imports", () => {
        expect(bundle).not.toContain(UNUSED_SIGNAL_HANDLER);
    });
});

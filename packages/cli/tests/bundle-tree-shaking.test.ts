import { readFileSync } from "node:fs";
import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { type AppProbe, probeAppProject, removeAppProject } from "./app-project.js";

const BUILD_TIMEOUT = 120_000;
const OUT_DIR = "dist";
const USED_NAME_PREFIX = "used-name=";
const USED_TYPE_PREFIX = "used-type=";
const INDEXED_TYPE_PREFIX = "indexed-type=";
const UNUSED_CLASS_METHOD = "getAutoplay";
const UNUSED_GET_TYPE = "gtk_video_get_type";

const APP_CONFIG = `export default {
    applicationId: "com.gtkx.clitreeshakingprobe",
    codegen: false,
    libraries: ["Gtk-4.0"],
    future: {
        v2ByteArrays: true,
        v2ValueReturns: true,
        v2FinishResults: true,
        v2InoutReturns: true,
        v2ResourceImports: true,
        v2TreeShaking: true,
    },
};
`;

const APP_ENTRY = String.raw`import { Task } from "@gtkx/gi/gio";
import { typeFromName } from "@gtkx/runtime";

process.stdout.write("${USED_NAME_PREFIX}" + Task.name + "\n");
process.stdout.write("${USED_TYPE_PREFIX}" + String(typeFromName("GTask") !== 0n) + "\n");
process.stdout.write("${INDEXED_TYPE_PREFIX}" + String(typeFromName("GSubprocess") !== 0n) + "\n");
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

    it("resolves an unimported class's type name", () => {
        expect(probe.run.stdout).toContain(`${INDEXED_TYPE_PREFIX}true\n`);
    });

    it("drops the namespaces the app never imports", () => {
        expect(bundle).not.toContain(UNUSED_CLASS_METHOD);
        expect(bundle).not.toContain(UNUSED_GET_TYPE);
    });
});

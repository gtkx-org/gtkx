import { mkdirSync, readdirSync, readFileSync, readlinkSync, rmSync, symlinkSync } from "node:fs";
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
process.stdout.write("${DROPPED_TYPE_PREFIX}" + String(typeFromName("GtkVideo") !== 0n) + "\n");
`;

const USED_SIGNAL_HANDLER = "onClicked";
const UNUSED_SIGNAL_HANDLER = "onActivateLink";

const REACT_APP_ENTRY = String.raw`import { GtkButton } from "@gtkx/jsx";

process.stdout.write("used-component=" + typeof GtkButton + "\n");
`;

const ANIMATED_APP_ENTRY = String.raw`import { animated } from "@gtkx/animated";
import { GtkButton } from "@gtkx/jsx";

const Member = animated.GtkLabel;
const Called = animated(GtkButton);

process.stdout.write("animated=" + typeof Member + typeof Called + "\n");
`;

const DYNAMIC_ANIMATED_APP_ENTRY = String.raw`import { animated } from "@gtkx/animated";

process.stdout.write("dynamic=" + String(Object.keys(animated).length > 0) + "\n");
`;

const ANIMATED_APP_MANIFEST = `${JSON.stringify(
    {
        name: "gtkx-animated-probe",
        type: "module",
        dependencies: { "@gtkx/animated": "*", "@gtkx/react": "*", react: "*" },
    },
    null,
    4,
)}\n`;

const linkEntries = (source: string, target: string, skipped: string): void => {
    for (const entry of readdirSync(source)) {
        if (entry !== skipped) {
            symlinkSync(join(source, entry), join(target, entry));
        }
    }
};

const linkAnimatedPackage = (project: AppProject): void => {
    const modules = join(project.root, "node_modules");
    const workspaceModules = readlinkSync(modules);
    rmSync(modules);
    mkdirSync(join(modules, "@gtkx"), { recursive: true });
    linkEntries(workspaceModules, modules, "@gtkx");
    linkEntries(join(workspaceModules, "@gtkx"), join(modules, "@gtkx"), "animated");
    symlinkSync(join(workspaceModules, "..", "packages", "animated"), join(modules, "@gtkx", "animated"));
};

const removeAnimatedProject = (project: AppProject): void => {
    rmSync(join(project.root, "node_modules"), { recursive: true, force: true });
    removeAppProject(project);
};

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

describe("gtkx build (animated tree shaking)", () => {
    let project: AppProject;
    let bundle: string;

    beforeAll(async () => {
        project = createAppProject({
            applicationId: "com.gtkx.clianimatedprobe",
            entry: ANIMATED_APP_ENTRY,
            files: { "gtkx.config.mjs": APP_CONFIG, "package.json": ANIMATED_APP_MANIFEST },
            packageType: "module",
            prefix: "gtkx-bundle-animated-",
        });

        linkAnimatedPackage(project);
        const reported = await buildAppProject({ project, outDir: OUT_DIR });
        bundle = readFileSync(join(project.root, reported), "utf8");
    }, BUILD_TIMEOUT);

    afterAll(() => {
        removeAnimatedProject(project);
    });

    it("rewrites member access and calls into the widgets they animate", () => {
        expect(bundle).toContain("withAnimated");
        expect(bundle).toContain("gtk_label_get_type");
    });

    it("drops the widgets the app never animates", () => {
        expect(bundle).not.toContain(UNUSED_CLASS_METHOD);
    });
});

describe("gtkx build (animated used dynamically)", () => {
    let project: AppProject;
    let bundle: string;

    beforeAll(async () => {
        project = createAppProject({
            applicationId: "com.gtkx.clianimateddynamic",
            entry: DYNAMIC_ANIMATED_APP_ENTRY,
            files: { "gtkx.config.mjs": APP_CONFIG, "package.json": ANIMATED_APP_MANIFEST },
            packageType: "module",
            prefix: "gtkx-bundle-animated-dynamic-",
        });

        linkAnimatedPackage(project);
        const reported = await buildAppProject({ project, outDir: OUT_DIR });
        bundle = readFileSync(join(project.root, reported), "utf8");
    }, BUILD_TIMEOUT);

    afterAll(() => {
        removeAnimatedProject(project);
    });

    it("keeps the whole widget namespace behind the proxy", () => {
        expect(bundle).toContain(UNUSED_GET_TYPE);
    });
});

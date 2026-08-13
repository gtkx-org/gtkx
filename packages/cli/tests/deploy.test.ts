import { existsSync } from "node:fs";
import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
    type CliProject,
    createCliProject,
    listProjectFiles,
    removeCliProject,
    runCli,
    STORE_LIBRARIES,
} from "./cli-project.js";

const APPLICATION_ID = "com.gtkx.clideploy";
const OUT_DIR = "build";
const TARGETS = "appimage,deb,flatpak,rpm";
const ICON_PATH = join("icons", "hicolor", "scalable", "apps", `${APPLICATION_ID}.svg`);

const MANIFEST = {
    name: "gtkx-cli-deploy",
    version: "2.3.4",
    description: "Probe application for the deploy command",
    license: "MPL-2.0",
    author: "GTKX <hello@gtkx.dev>",
    type: "module",
    imports: { "#data/*": "./data/*" },
};

const DEPLOY_BLOCK = `    deploy: {
        name: "Deploy Probe",
        summary: "Probes what the deploy command writes",
        description: ["A probe application that exercises the deploy command."],
        categories: ["Utility"],
        developer: { name: "GTKX", email: "hello@gtkx.dev" },
        homepage: "https://gtkx.dev",
        license: "MPL-2.0",
    },
`;

const APP_SOURCE = `import { GtkApplication, GtkApplicationWindow, GtkLabel } from "@gtkx/jsx/gtk";
import { createRoot } from "@gtkx/react";

createRoot().render(
    <GtkApplication>
        <GtkApplicationWindow title="Probe">
            <GtkLabel label="probe" />
        </GtkApplicationWindow>
    </GtkApplication>,
);
`;

const STAGE_PREFIX = "stage/";
const BINARY_NAME = "gtkx-cli-deploy";

const EXPECTED_STAGED = [
    join(STAGE_PREFIX, "bin", BINARY_NAME),
    join(STAGE_PREFIX, "lib", BINARY_NAME, "bundle.mjs"),
    join(STAGE_PREFIX, "lib", BINARY_NAME, "gtkx.node"),
    join(STAGE_PREFIX, "share", "applications", `${APPLICATION_ID}.desktop`),
    join(STAGE_PREFIX, "share", "icons", "hicolor", "scalable", "apps", `${APPLICATION_ID}.svg`),
];

const EXPECTED_MANIFESTS = [
    join("metadata", `${APPLICATION_ID}.desktop`),
    join("metadata", `${APPLICATION_ID}.metainfo.xml`),
    join("targets", "deb", "nfpm.yaml"),
    join("targets", "rpm", "nfpm.yaml"),
    join("targets", "flatpak", `${APPLICATION_ID}.yml`),
];

const config = (body: string): string =>
    `export default {\n    applicationId: "${APPLICATION_ID}",\n` +
    `    libraries: ${JSON.stringify(STORE_LIBRARIES)},\n${body}};\n`;

const projectFiles = (): Record<string, string> => ({
    "package.json": `${JSON.stringify(MANIFEST, null, 4)}\n`,
    LICENSE: "Mozilla Public License Version 2.0\n",
    [join("data", ICON_PATH)]: "<svg/>\n",
    [join("src", "index.tsx")]: APP_SOURCE,
});

const outputNames = (project: CliProject): string[] => listProjectFiles(project, OUT_DIR);

describe("gtkx deploy (manifests only)", () => {
    const state: { project: CliProject; status: number | null } = {
        project: { root: "", nodeModules: "" },
        status: null,
    };

    beforeAll(() => {
        state.project = createCliProject({
            prefix: "gtkx-cli-deploy-",
            config: config(DEPLOY_BLOCK),
            files: projectFiles(),
            hasStore: true,
        });

        state.status = runCli(state.project, ["deploy", "--print-manifests", "--target", TARGETS]).status;
    });

    afterAll(() => {
        removeCliProject(state.project);
    });

    it("writes the freedesktop metadata and a manifest per target", () => {
        const written = outputNames(state.project);
        expect(state.status).toBe(0);
        expect(EXPECTED_MANIFESTS.filter((name) => !written.includes(name))).toEqual([]);
    });

    it("stages the built application beside them", () => {
        const staged = new Set(outputNames(state.project).filter((name) => name.startsWith(STAGE_PREFIX)));
        expect(EXPECTED_STAGED.filter((name) => !staged.has(name))).toEqual([]);
    });
});

describe("gtkx deploy (projects it refuses to package)", () => {
    it("fails when the configuration declares nothing to deploy", () => {
        const project = createCliProject({
            prefix: "gtkx-cli-deploy-bare-",
            config: config(""),
            files: projectFiles(),
            hasStore: true,
        });

        try {
            expect(runCli(project, ["deploy", "--print-manifests"]).status).not.toBe(0);
            expect(existsSync(join(project.root, OUT_DIR))).toBe(false);
        } finally {
            removeCliProject(project);
        }
    });

    it("fails over a target it does not know", () => {
        const project = createCliProject({
            prefix: "gtkx-cli-deploy-target-",
            config: config(DEPLOY_BLOCK),
            files: projectFiles(),
            hasStore: true,
        });

        try {
            expect(runCli(project, ["deploy", "--print-manifests", "--target", "snap"]).status).not.toBe(0);
            expect(existsSync(join(project.root, OUT_DIR))).toBe(false);
        } finally {
            removeCliProject(project);
        }
    });
});

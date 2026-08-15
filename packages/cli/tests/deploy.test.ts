import { chmodSync, existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { parse } from "yaml";
import {
    type CliProject,
    createCliProject,
    initGitRepo,
    listProjectFiles,
    removeCliProject,
    runCli,
    STORE_FUTURE,
    STORE_LIBRARIES,
} from "./cli-project.js";

type FlatpakSource = {
    type?: string;
    url?: string;
    sha512?: string;
    tag?: string;
    commit?: string;
    "dest-filename"?: string;
};

type FlatpakModule = {
    sources: (FlatpakSource | string)[];
    "build-options": { "append-path": string; env: Record<string, string> };
    "build-commands": string[];
};

type FlatpakManifest = { modules: FlatpakModule[] };
type DeployProbe = { project: CliProject; status: number | null };

type DeploySetup = {
    prefix: string;
    config: string;
    files: Record<string, string>;
    args: string[];
};

const APPLICATION_ID = "com.gtkx.clideploy";
const OUT_DIR = "build";
const TARGETS = "appimage,deb,flatpak,rpm";
const ICON_PATH = join("icons", "hicolor", "scalable", "apps", `${APPLICATION_ID}.svg`);
const STAGE_PREFIX = "stage/";
const BINARY_NAME = "gtkx-cli-deploy";
const MODULE_DIR = `/run/build/${BINARY_NAME}`;
const NODE_EXTENSION_DIR = "/usr/lib/sdk/node24";
const NODE_EXTENSION_PATH = `${NODE_EXTENSION_DIR}/bin`;
const APPEND_PATH = `${MODULE_DIR}/flatpak-pnpm:${NODE_EXTENSION_PATH}`;
const PNPM_VERSION = "11.21.0";
const PNPM_TARBALL = `pnpm-${PNPM_VERSION}.tgz`;

const PNPM_SHA512 = "521705bce689924eac72f5a3587122f362689ef6571e55ba80076fd637c11132ecffada26" +
    "fad4ea79c485bfddbfd3d5a2a5b05805a77e893de71ec8a6cca3bb1";

const PNPM_PIN = `pnpm@${PNPM_VERSION}+sha512.${PNPM_SHA512}`;
const PNPM_INSTALL = "pnpm install --offline --frozen-lockfile --trust-lockfile";
const SOURCE_URL = "https://github.com/gtkx-org/cli-deploy-probe.git";
const SOURCE_COMMIT = "4c1d0f7b2a9e5c38f61b0d47ae92c5138b7ff204";
const SOURCE_TAG = "v2.3.4";
const PINNED_SOURCE = `{ url: "${SOURCE_URL}", commit: "${SOURCE_COMMIT}" }`;
const TAGGED_SOURCE = `{ url: "${SOURCE_URL}", tag: "${SOURCE_TAG}" }`;
const SOURCE_ARGS = ["deploy", "--print-manifests", "--target", "flatpak"];
const COMMIT_PATTERN = /^[\da-f]{40}$/;
const LOCKFILE_NAME = "pnpm-lock.yaml";
const NPM_LOCKFILE_NAME = "package-lock.json";
const NPM_INSTALL = "npm ci --offline";
const GENERATED_SOURCES = join("targets", "flatpak", "generated-sources.json");
const MANIFEST_PATH = join("targets", "flatpak", `${APPLICATION_ID}.yml`);

const PACKAGE_INTEGRITY = "sha512-41Cifkg6e8TylSpdtTpeLVMqvSBEVzTttHvERD741+pnZ8ANv0004MRL43QKPDlK9" +
    "cGvNp6NZWZUBlbGXYxxng==";

const DESCRIPTION =
    "A probe application that exercises the deploy command and every Flathub manifest it renders.";

const MANIFEST = {
    name: BINARY_NAME,
    version: "2.3.4",
    description: "Probe application for the deploy command",
    license: "MPL-2.0",
    author: "GTKX <hello@gtkx.dev>",
    type: "module",
    imports: { "#data/*": "./data/*" },
};

const DEPLOY_FIELDS = `        name: "Deploy Probe",
        summary: "Probes what the deploy command writes",
        description: ["${DESCRIPTION}"],
        categories: ["Utility"],
        developer: { name: "GTKX", email: "hello@gtkx.dev" },
        homepage: "https://gtkx.dev",
        license: "MPL-2.0",`;

const DEPLOY_BLOCK = `    deploy: {\n${DEPLOY_FIELDS}\n    },\n`;

const LOCKFILE = `lockfileVersion: '9.0'

settings:
  autoInstallPeers: true
  excludeLinksFromLockfile: false

importers:

  .:
    dependencies:
      is-number:
        specifier: ^7.0.0
        version: 7.0.0

packages:

  is-number@7.0.0:
    resolution: {integrity: ${PACKAGE_INTEGRITY}}

snapshots:

  is-number@7.0.0: {}
`;

const STALE_GENERATOR = `#!/bin/sh
if [ "$1" = "--help" ]; then
    echo "usage: flatpak-node-generator [-h] {npm,yarn} lockfile"
    exit 0
fi
if [ "$1" = "pnpm" ]; then
    echo "flatpak-node-generator: error: argument type: invalid choice: 'pnpm'" >&2
    exit 2
fi
while [ $# -gt 0 ]; do
    if [ "$1" = "-o" ]; then
        shift
        echo '[]' > "$1"
        exit 0
    fi
    shift
done
exit 2
`;

const NPM_LOCKFILE = `{
    "name": "${BINARY_NAME}",
    "version": "2.3.4",
    "lockfileVersion": 3,
    "requires": true,
    "packages": {
        "": { "name": "${BINARY_NAME}", "version": "2.3.4" }
    }
}
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
    MANIFEST_PATH,
];

const config = (body: string): string =>
    `export default {\n    applicationId: "${APPLICATION_ID}",\n` +
    `    libraries: ${JSON.stringify(STORE_LIBRARIES)},\n` +
    `    future: ${JSON.stringify(STORE_FUTURE)},\n${body}};\n`;

const sourceConfig = (source: string): string =>
    config(`    deploy: {\n${DEPLOY_FIELDS}\n        flatpak: { mode: "source", source: ${source} },\n    },\n`);

const projectFiles = (): Record<string, string> => ({
    "package.json": `${JSON.stringify(MANIFEST, null, 4)}\n`,
    LICENSE: "Mozilla Public License Version 2.0\n",
    [join("data", ICON_PATH)]: "<svg/>\n",
    [join("src", "index.tsx")]: APP_SOURCE,
});

const sourceFiles = (pin: string): Record<string, string> => ({
    ...projectFiles(),
    "package.json": `${JSON.stringify({ ...MANIFEST, packageManager: pin }, null, 4)}\n`,
    [LOCKFILE_NAME]: LOCKFILE,
});

const npmSourceFiles = (): Record<string, string> => ({
    ...projectFiles(),
    [NPM_LOCKFILE_NAME]: NPM_LOCKFILE,
});

const outputNames = (project: CliProject): string[] => listProjectFiles(project, OUT_DIR);

const flatpakModule = (project: CliProject): FlatpakModule => {
    const contents = readFileSync(join(project.root, OUT_DIR, MANIFEST_PATH), "utf8");
    const manifest = parse(contents) as FlatpakManifest;
    const appModule = manifest.modules.at(-1);

    if (appModule === undefined) {
        throw new Error(`${MANIFEST_PATH} declares no modules`);
    }

    return appModule;
};

const isSourceEntry = (entry: FlatpakSource | string): entry is FlatpakSource => typeof entry !== "string";

const findSource = (appModule: FlatpakModule, type: string): FlatpakSource | undefined =>
    appModule.sources.filter(isSourceEntry).find((entry) => entry.type === type);

const stubGenerator = (): string => {
    const dir = mkdtempSync(join(tmpdir(), "gtkx-cli-generator-"));
    const path = join(dir, "flatpak-node-generator");
    writeFileSync(path, STALE_GENERATOR);
    chmodSync(path, 0o755);

    return dir;
};

const deployProbe = (setup: DeploySetup): DeployProbe => {
    const { args, ...options } = setup;
    const probe: DeployProbe = { project: { root: "", nodeModules: "" }, status: null };

    beforeAll(() => {
        probe.project = createCliProject({ ...options, hasStore: true });
        probe.status = runCli(probe.project, args).status;
    });

    afterAll(() => {
        removeCliProject(probe.project);
    });

    return probe;
};

const expectRefusal = (prefix: string, source: string, pin: string, env?: NodeJS.ProcessEnv): void => {
    const project = createCliProject({
        prefix,
        config: sourceConfig(source),
        files: sourceFiles(pin),
        hasStore: true,
    });

    try {
        expect(runCli(project, SOURCE_ARGS, env).status).not.toBe(0);
    } finally {
        removeCliProject(project);
    }
};

describe("gtkx deploy (manifests only)", () => {
    const state = deployProbe({
        prefix: "gtkx-cli-deploy-",
        config: config(DEPLOY_BLOCK),
        files: projectFiles(),
        args: ["deploy", "--print-manifests", "--target", TARGETS],
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

describe("gtkx deploy (flatpak source mode)", () => {
    const state = deployProbe({
        prefix: "gtkx-cli-deploy-source-",
        config: sourceConfig(PINNED_SOURCE),
        files: sourceFiles(PNPM_PIN),
        args: SOURCE_ARGS,
    });

    it("vendors a hash-pinned pnpm beside the offline sources", () => {
        const appModule = flatpakModule(state.project);
        const archive = findSource(appModule, "archive");
        expect(state.status).toBe(0);
        expect(outputNames(state.project)).toContain(GENERATED_SOURCES);
        expect(archive?.url).toContain(PNPM_TARBALL);
        expect(archive?.sha512).toBe(PNPM_SHA512);
        expect(findSource(appModule, "script")?.["dest-filename"]).toBe("pnpm");
        expect(appModule["build-options"]["append-path"]).toBe(APPEND_PATH);
        expect(appModule["build-commands"][0]).toBe(PNPM_INSTALL);
        expect(Object.keys(appModule["build-options"].env)).toEqual(["npm_config_nodedir"]);
    });
});

describe("gtkx deploy (flatpak source mode without pnpm)", () => {
    it("renders an npm manifest with a generator that cannot vendor pnpm", () => {
        const shim = stubGenerator();

        const project = createCliProject({
            prefix: "gtkx-cli-deploy-npm-",
            config: sourceConfig(PINNED_SOURCE),
            files: npmSourceFiles(),
            hasStore: true,
        });

        try {
            const env = { PATH: `${shim}:${process.env.PATH ?? ""}` };
            expect(runCli(project, SOURCE_ARGS, env).status).toBe(0);
            const appModule = flatpakModule(project);
            expect(appModule["build-commands"][0]).toBe(NPM_INSTALL);
            expect(appModule["build-options"]["append-path"]).toBe(NODE_EXTENSION_PATH);
            expect(findSource(appModule, "archive")).toBeUndefined();
        } finally {
            removeCliProject(project);
            rmSync(shim, { recursive: true, force: true });
        }
    });
});

describe("gtkx deploy (flatpak source revisions)", () => {
    it("pins the commit behind a configured tag", () => {
        const project = createCliProject({
            prefix: "gtkx-cli-deploy-tag-",
            config: sourceConfig(TAGGED_SOURCE),
            files: sourceFiles(PNPM_PIN),
            hasStore: true,
        });

        try {
            initGitRepo(project, SOURCE_TAG);
            expect(runCli(project, SOURCE_ARGS).status).toBe(0);
            const git = findSource(flatpakModule(project), "git");
            expect(git?.tag).toBe(SOURCE_TAG);
            expect(git?.commit).toMatch(COMMIT_PATTERN);
        } finally {
            removeCliProject(project);
        }
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

describe("gtkx deploy (Flathub sources it refuses)", () => {
    it("fails when the pinned pnpm carries no integrity digest", () => {
        expectRefusal("gtkx-cli-deploy-unpinned-", PINNED_SOURCE, `pnpm@${PNPM_VERSION}`);
    });

    it("fails when the pinned pnpm cannot install offline", () => {
        expectRefusal("gtkx-cli-deploy-untrusted-", PINNED_SOURCE, `pnpm@11.2.2+sha512.${PNPM_SHA512}`);
    });

    it("fails when the configured tag resolves to no commit", () => {
        expectRefusal("gtkx-cli-deploy-untagged-", TAGGED_SOURCE, PNPM_PIN);
    });

    it("fails when the installed flatpak-node-generator cannot vendor pnpm", () => {
        const shim = stubGenerator();

        try {
            expectRefusal("gtkx-cli-deploy-stale-", PINNED_SOURCE, PNPM_PIN, {
                PATH: `${shim}:${process.env.PATH ?? ""}`,
            });
        } finally {
            rmSync(shim, { recursive: true, force: true });
        }
    });
});

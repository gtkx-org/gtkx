import {
    chmodSync,
    existsSync,
    mkdtempSync,
    readFileSync,
    rmSync,
    statSync,
    symlinkSync,
    writeFileSync,
} from "node:fs";
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
    contents?: string;
    "dest-filename"?: string;
};

type FlatpakModule = {
    sources: (FlatpakSource | string)[];
    "build-options": { "append-path": string; env: Record<string, string> };
    "build-commands": string[];
};

type FlatpakManifest = { modules: FlatpakModule[]; "finish-args": string[]; cleanup: string[] };
type NfpmContent = { dst: string; file_info?: { mode: number } };
type NfpmConfig = { contents: NfpmContent[]; depends: string[] };
type DeployProbe = { project: CliProject; status: number | null };
type DeployRun = { status: number | null; output: string };

type DeploySetup = {
    prefix: string;
    config: string;
    files: Record<string, string>;
    args: string[];
    executables?: string[] | undefined;
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
const PNPM_VERSION = "11.22.0";
const PNPM_TARBALL = `pnpm-${PNPM_VERSION}.tgz`;

const PNPM_SHA512 = "1ff870c4c6133dfd88fb2afc46dd13d47f09c9794b438c6fdb47ca98caf3bc16381ee0be9" +
    "3a091b8e3824cf01f889f46d7d9e20910fb0be1ab0fb5baa80dd621";

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
const NFPM_PATH = join("targets", "deb", "nfpm.yaml");
const RPM_NFPM_PATH = join("targets", "rpm", "nfpm.yaml");
const GI_STORE_DIR = join("node_modules", ".gtkx", "gi");
const LIBRARIES_INVENTORY = join(GI_STORE_DIR, "libraries.json");
const MODE_MASK = 0o7777;
const HELPER_SOURCE = join("tools", "helper.sh");
const NOTES_SOURCE = join("tools", "notes.txt");
const HELPER_DESTINATION = join("lib", BINARY_NAME, "helper.sh");
const NOTES_DESTINATION = join("share", BINARY_NAME, "notes.txt");
const SECRET_DESTINATION = join("lib", BINARY_NAME, "secret.conf");
const HELPER_PACKAGE_PATH = `/usr/lib/${BINARY_NAME}/helper.sh`;
const FLATPAK_DEST = "${FLATPAK_DEST}";
const MIME_TYPE = "application/x-gtkx-probe";
const MIME_FILENAME = `${APPLICATION_ID}.xml`;
const MIME_INSTALL = `install -Dm644 ${MIME_FILENAME} ${FLATPAK_DEST}/share/mime/packages/${MIME_FILENAME}`;
const HELPER_INSTALL = `install -Dm755 tools/helper.sh ${FLATPAK_DEST}/lib/${BINARY_NAME}/helper.sh`;
const LICENSE_INSTALL = `install -Dm644 LICENSE ${FLATPAK_DEST}/share/licenses/${BINARY_NAME}/LICENSE`;
const DEFAULT_FINISH_ARGS = ["--share=ipc", "--socket=wayland", "--socket=fallback-x11", "--device=dri"];
const DEFAULT_CLEANUP = ["/include", "/share/pkgconfig", "*.la", "*.a"];
const MERGED_NEGATIONS = ["--share=ipc", "--device=dri", "--nosocket=wayland", "--nosocket=fallback-x11"];
const HELPER_SCRIPT = "#!/bin/sh\necho probe\n";
const NOTES = "Probe notes.\n";

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

const EXTRA_FILES = `        extraFiles: {
            "lib/${BINARY_NAME}/helper.sh": "tools/helper.sh",
            "share/${BINARY_NAME}/notes.txt": "tools/notes.txt",
            "lib/${BINARY_NAME}/secret.conf": { source: "tools/notes.txt", mode: "600" },
        },
`;

const PERMISSIONS = `        flatpak: { finishArgs: ["--share=network"], cleanup: ["/man"] },
`;

const NO_DISPLAY = `        flatpak: { finishArgs: ["--nosocket=wayland", "--nosocket=fallback-x11"], cleanup: [] },
`;

const SOURCE_PAYLOAD = `        fileAssociations: [{ extension: "probe", mimeType: "${MIME_TYPE}" }],
        extraFiles: { "lib/${BINARY_NAME}/helper.sh": "tools/helper.sh" },
`;

const BAD_MODE = `        extraFiles: {
            "share/${BINARY_NAME}/notes.txt": { source: "tools/notes.txt", mode: "8" },
        },
`;

const MINIMUM_OVERRIDES = `        minimumLibraryVersions: { "Gtk-4.0": "4.14" },
`;

const FOREIGN_INVENTORY = `${JSON.stringify({ libraries: ["Adw-1"], versions: [] }, null, 2)}\n`;
const DEPLOY_BLOCK = `    deploy: {\n${DEPLOY_FIELDS}\n${EXTRA_FILES}${PERMISSIONS}    },\n`;
const MINIMUMS_BLOCK = `    deploy: {\n${DEPLOY_FIELDS}\n${MINIMUM_OVERRIDES}    },\n`;
const NO_DISPLAY_BLOCK = `    deploy: {\n${DEPLOY_FIELDS}\n${NO_DISPLAY}    },\n`;
const BAD_MODE_BLOCK = `    deploy: {\n${DEPLOY_FIELDS}\n${BAD_MODE}    },\n`;

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

const COPYRIGHT_PATH = join("overlay", "deb", "share", "doc", BINARY_NAME, "copyright");
const NOTICES_FILENAME = "THIRD-PARTY-NOTICES";
const NOTICE_TARGETS = ["appimage", "flatpak", "rpm"];
const PACKAGES_MANIFEST = "gtkx-packages.json";
const NODE_STANZA = `Files: lib/${BINARY_NAME}/node`;
const NATIVE_STANZA = `Files: lib/${BINARY_NAME}/gtkx.node`;
const BUNDLE_STANZA = `Files: lib/${BINARY_NAME}/bundle.mjs`;
const COPYRIGHT_FORMAT = "Format: https://www.debian.org/doc/packaging-manuals/copyright-format/1.0/";
const NOTICES_HEADING = "THIRD-PARTY NOTICES";
const MIT_SENTENCE = "Permission is hereby granted, free of charge";
const GTKX_SOURCE = "Source: https://github.com/gtkx-org/gtkx";
const PLATFORM_LIBRARY = "GTK (LGPL-2.1-or-later): https://gitlab.gnome.org/GNOME/gtk";
const PLATFORM_SECTION = "Platform libraries";
const PLATFORM_SOURCE = "Source: https://gitlab.gnome.org/GNOME/gtk";
const DEPENDENCY_NAME = "probe-dependency";
const DEPENDENCY_VERSION = "1.0.0";
const UNDECLARED_LICENSE = "License: unknown";
const RUNTIME_BINARY = join("runtime", "bin", "node");
const RUNTIME_LICENSE = join("runtime", "LICENSE");
const NODE_LICENSE_TEXT = "Node.js probe license, standing in for the release archive.";
const OWN_LICENSE_TEXT = "Probe proprietary license, all rights reserved, and not Node's.";
const APPLICATION_STANZA = "Deploy Probe (MPL-2.0)";
const DEPENDENCY_SECTION = "Bundled JavaScript dependencies";
const BARE_APP_SOURCE = "process.env.PROBE_LABEL = \"probe\";\n";
const NOTICES_DEST = `${FLATPAK_DEST}/share/licenses/${BINARY_NAME}/${NOTICES_FILENAME}`;
const NOTICES_INSTALL = `install -Dm644 ${NOTICES_FILENAME} ${NOTICES_DEST}`;

const DEPENDENCY_MANIFEST = {
    name: DEPENDENCY_NAME,
    version: DEPENDENCY_VERSION,
    type: "module",
    main: "index.js",
};

const DEPENDENCY_SOURCE = `const probeLabel = "probe";

export { probeLabel };
`;

const NOTICES_APP_SOURCE = `import { GtkApplication, GtkApplicationWindow, GtkLabel } from "@gtkx/jsx/gtk";
import { createRoot } from "@gtkx/react";
import { probeLabel } from "${DEPENDENCY_NAME}";

process.env.PROBE_LABEL = probeLabel;

createRoot().render(
    <GtkApplication>
        <GtkApplicationWindow title="Probe">
            <GtkLabel label="probe" />
        </GtkApplicationWindow>
    </GtkApplication>,
);
`;

const RUNTIME_NODE = `        node: { source: "path", path: "${RUNTIME_BINARY}" },
`;

const NOTICES_BLOCK = `    deploy: {\n${DEPLOY_FIELDS}\n${RUNTIME_NODE}    },\n`;

const config = (body: string): string =>
    `export default {\n    applicationId: "${APPLICATION_ID}",\n` +
    `    libraries: ${JSON.stringify(STORE_LIBRARIES)},\n` +
    `    future: ${JSON.stringify(STORE_FUTURE)},\n${body}};\n`;

const wildcardConfig = (body: string): string =>
    `export default {\n    applicationId: "${APPLICATION_ID}",\n    libraries: "*",\n` +
    `    future: ${JSON.stringify(STORE_FUTURE)},\n${body}};\n`;

const bareConfig = (body: string): string =>
    `export default {\n    applicationId: "${APPLICATION_ID}",\n` +
    `    future: ${JSON.stringify(STORE_FUTURE)},\n${body}};\n`;

const sourceConfig = (source: string, extra = ""): string =>
    config(
        `    deploy: {\n${DEPLOY_FIELDS}\n${extra}` +
        `        flatpak: { mode: "source", source: ${source} },\n    },\n`,
    );

const projectFiles = (): Record<string, string> => ({
    "package.json": `${JSON.stringify(MANIFEST, null, 4)}\n`,
    LICENSE: "Mozilla Public License Version 2.0\n",
    [join("data", ICON_PATH)]: "<svg/>\n",
    [join("src", "index.tsx")]: APP_SOURCE,
    [HELPER_SOURCE]: HELPER_SCRIPT,
    [NOTES_SOURCE]: NOTES,
});

const noticesFiles = (): Record<string, string> => ({
    ...projectFiles(),
    [join("src", "index.tsx")]: NOTICES_APP_SOURCE,
    [join("node_modules", DEPENDENCY_NAME, "package.json")]: `${JSON.stringify(DEPENDENCY_MANIFEST, null, 4)}\n`,
    [join("node_modules", DEPENDENCY_NAME, "index.js")]: DEPENDENCY_SOURCE,
    [RUNTIME_BINARY]: "",
    [RUNTIME_LICENSE]: `${NODE_LICENSE_TEXT}\n`,
});

const strangeRuntimeFiles = (): Record<string, string> => ({
    ...noticesFiles(),
    [RUNTIME_LICENSE]: `${OWN_LICENSE_TEXT}\n`,
});

const bareFiles = (): Record<string, string> => ({
    ...projectFiles(),
    [join("src", "index.tsx")]: BARE_APP_SOURCE,
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

const outputFile = (project: CliProject, ...segments: string[]): string =>
    readFileSync(join(project.root, OUT_DIR, ...segments), "utf8");

const noticesFor = (project: CliProject, target: string): string =>
    outputFile(project, join("overlay", target, "share", "licenses", BINARY_NAME, NOTICES_FILENAME));

const stanzaFor = (copyright: string, files: string): string =>
    copyright.split("\nFiles: ").find((stanza) => stanza.startsWith(`${files}\n`)) ?? "";

const flatpakManifest = (project: CliProject): FlatpakManifest => {
    const contents = readFileSync(join(project.root, OUT_DIR, MANIFEST_PATH), "utf8");

    return parse(contents) as FlatpakManifest;
};

const flatpakModule = (project: CliProject): FlatpakModule => {
    const appModule = flatpakManifest(project).modules.at(-1);

    if (appModule === undefined) {
        throw new Error(`${MANIFEST_PATH} declares no modules`);
    }

    return appModule;
};

const stagedMode = (project: CliProject, destination: string): number =>
    statSync(join(project.root, OUT_DIR, "stage", destination)).mode & MODE_MASK;

const packagedMode = (project: CliProject, destination: string): number | undefined => {
    const contents = readFileSync(join(project.root, OUT_DIR, NFPM_PATH), "utf8");
    const nfpm = parse(contents) as NfpmConfig;

    return nfpm.contents.find((entry) => entry.dst === destination)?.file_info?.mode;
};

const packagedDepends = (project: CliProject, path: string): string[] => {
    const contents = readFileSync(join(project.root, OUT_DIR, path), "utf8");

    return (parse(contents) as NfpmConfig).depends;
};

const isSourceEntry = (entry: FlatpakSource | string): entry is FlatpakSource => typeof entry !== "string";

const findInlineSource = (appModule: FlatpakModule, fileName: string): FlatpakSource | undefined =>
    appModule.sources.filter(isSourceEntry).find((entry) => entry["dest-filename"] === fileName);

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
    const { args, executables = [], ...options } = setup;
    const probe: DeployProbe = { project: { root: "", nodeModules: "" }, status: null };

    beforeAll(() => {
        probe.project = createCliProject({ ...options, hasStore: true });

        for (const name of executables) {
            chmodSync(join(probe.project.root, name), 0o755);
        }

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
        executables: [HELPER_SOURCE],
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

    it("installs an extra file with the mode it has and the mode it was given", () => {
        expect(state.status).toBe(0);
        expect(stagedMode(state.project, HELPER_DESTINATION)).toBe(0o755);
        expect(stagedMode(state.project, NOTES_DESTINATION)).toBe(0o644);
        expect(stagedMode(state.project, SECRET_DESTINATION)).toBe(0o600);
        expect(packagedMode(state.project, HELPER_PACKAGE_PATH)).toBe(0o755);
    });

    it("merges the configured finish-args and cleanup into the defaults", () => {
        const manifest = flatpakManifest(state.project);
        expect(manifest["finish-args"]).toEqual([...DEFAULT_FINISH_ARGS, "--share=network"]);
        expect(manifest.cleanup).toEqual([...DEFAULT_CLEANUP, "/man"]);
    });

    it("names the toolkit packages with no minimum version of their own", () => {
        const depends = packagedDepends(state.project, NFPM_PATH);
        expect(depends).toEqual(expect.arrayContaining(["libgtk-4-1", "libadwaita-1-0"]));
        expect(depends.filter((entry) => entry.startsWith("libgtk-4-1 ("))).toEqual([]);
        expect(packagedDepends(state.project, RPM_NFPM_PATH)).toEqual(expect.arrayContaining(["gtk4", "libadwaita"]));
    });

    it("leaves the relations that carry no release of their own alone", () => {
        expect(packagedDepends(state.project, NFPM_PATH)).toContain("hicolor-icon-theme");
        expect(packagedDepends(state.project, RPM_NFPM_PATH)).toContain("libGLESv2.so.2()(64bit)");
    });
});

describe("gtkx deploy (minimum library versions the project sets itself)", () => {
    const state = deployProbe({
        prefix: "gtkx-cli-minimums-",
        config: config(MINIMUMS_BLOCK),
        files: projectFiles(),
        args: ["deploy", "--print-manifests", "--target", "deb,rpm"],
    });

    it("uses the minimum the project declares", () => {
        expect(state.status).toBe(0);
        expect(packagedDepends(state.project, NFPM_PATH)).toContain("libgtk-4-1 (>= 4.14)");
        expect(packagedDepends(state.project, RPM_NFPM_PATH)).toContain("gtk4 >= 4.14");
    });
});

describe("gtkx deploy (a store whose inventory is not shaped like one)", () => {
    const project: CliProject = { root: "", nodeModules: "" };
    let status: number | null = null;

    beforeAll(() => {
        const created = createCliProject({
            prefix: "gtkx-cli-foreign-",
            config: bareConfig(DEPLOY_BLOCK),
            files: projectFiles(),
            hasStore: true,
        });

        project.root = created.root;
        project.nodeModules = created.nodeModules;
        runCli(project, ["deploy", "--print-manifests", "--target", "deb"]);
        writeFileSync(join(project.root, LIBRARIES_INVENTORY), FOREIGN_INVENTORY);
        status = runCli(project, ["deploy", "--print-manifests", "--skip-build", "--target", "deb"]).status;
    });

    afterAll(() => {
        removeCliProject(project);
    });

    it("falls back to the library it generates by default", () => {
        expect(status).toBe(0);
        expect(packagedDepends(project, NFPM_PATH)).toContain("libgtk-4-1");
    });

    it("declares nothing the foreign inventory named", () => {
        expect(packagedDepends(project, NFPM_PATH)).not.toContain("libadwaita-1-0");
    });
});

describe("gtkx deploy (a store that recorded no libraries)", () => {
    const project: CliProject = { root: "", nodeModules: "" };
    let status: number | null = null;

    beforeAll(() => {
        const created = createCliProject({
            prefix: "gtkx-cli-unrecorded-",
            config: bareConfig(DEPLOY_BLOCK),
            files: projectFiles(),
            hasStore: true,
        });

        project.root = created.root;
        project.nodeModules = created.nodeModules;
        runCli(project, ["deploy", "--print-manifests", "--target", "deb"]);
        rmSync(join(project.root, LIBRARIES_INVENTORY), { force: true });
        status = runCli(project, ["deploy", "--print-manifests", "--skip-build", "--target", "deb"]).status;
    });

    afterAll(() => {
        removeCliProject(project);
    });

    it("still declares the library it generates by default", () => {
        expect(status).toBe(0);
        expect(packagedDepends(project, NFPM_PATH)).toContain("libgtk-4-1");
    });

    it("declares no minimum it could not determine", () => {
        expect(packagedDepends(project, NFPM_PATH).filter((entry) => entry.includes("(>="))).toEqual([]);
    });
});

describe("gtkx deploy (a project that binds whatever the build host installed)", () => {
    const project: CliProject = { root: "", nodeModules: "" };
    const state: DeployRun = { status: null, output: "" };

    beforeAll(() => {
        const created = createCliProject({
            prefix: "gtkx-cli-wildcard-",
            config: config(DEPLOY_BLOCK),
            files: projectFiles(),
            hasStore: true,
        });

        project.root = created.root;
        project.nodeModules = created.nodeModules;
        runCli(project, ["build"]);
        writeFileSync(join(project.root, "gtkx.config.ts"), wildcardConfig(DEPLOY_BLOCK));
        const run = runCli(project, ["deploy", "--print-manifests", "--skip-build", "--target", "deb"]);
        state.status = run.status;
        state.output = run.output;
    });

    afterAll(() => {
        removeCliProject(project);
    });

    it("keeps declaring the relations of everything its store bound", () => {
        expect(state.status).toBe(0);
        expect(packagedDepends(project, NFPM_PATH).filter((entry) => entry.startsWith("libgtk-4-1"))).toHaveLength(1);
    });
});

describe("gtkx deploy (flatpak defaults a config drops)", () => {
    it("drops the sockets it negates and the cleanup it empties, keeping every other default", () => {
        const project = createCliProject({
            prefix: "gtkx-cli-deploy-sockets-",
            config: config(NO_DISPLAY_BLOCK),
            files: projectFiles(),
            hasStore: true,
        });

        try {
            expect(runCli(project, SOURCE_ARGS).status).toBe(0);
            const manifest = flatpakManifest(project);
            expect(manifest["finish-args"]).toEqual(MERGED_NEGATIONS);
            expect(manifest.cleanup).toEqual([]);
        } finally {
            removeCliProject(project);
        }
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

describe("gtkx deploy (flatpak source mode payload)", () => {
    it("installs the extra files, the MIME package, the license, and the third-party notices", () => {
        const shim = stubGenerator();

        const project = createCliProject({
            prefix: "gtkx-cli-deploy-payload-",
            config: sourceConfig(PINNED_SOURCE, SOURCE_PAYLOAD),
            files: npmSourceFiles(),
            hasStore: true,
        });

        try {
            chmodSync(join(project.root, HELPER_SOURCE), 0o755);
            const env = { PATH: `${shim}:${process.env.PATH ?? ""}` };
            expect(runCli(project, SOURCE_ARGS, env).status).toBe(0);
            const appModule = flatpakModule(project);
            expect(findInlineSource(appModule, MIME_FILENAME)?.contents).toContain(MIME_TYPE);
            expect(appModule["build-commands"]).toContain(MIME_INSTALL);
            expect(appModule["build-commands"]).toContain(HELPER_INSTALL);
            expect(appModule["build-commands"]).toContain(LICENSE_INSTALL);
            expect(appModule["build-commands"]).toContain(NOTICES_INSTALL);
            expect(findInlineSource(appModule, NOTICES_FILENAME)?.contents).toContain(NOTICES_HEADING);
        } finally {
            removeCliProject(project);
            rmSync(shim, { recursive: true, force: true });
        }
    });
});

describe("gtkx deploy (flatpak source mode escapes)", () => {
    it("fails when an extra file is a symlink pointing outside the checkout", () => {
        const shim = stubGenerator();
        const outside = mkdtempSync(join(tmpdir(), "gtkx-cli-deploy-linked-"));
        const target = join(outside, "helper.sh");
        writeFileSync(target, HELPER_SCRIPT);
        const extra = `        extraFiles: { "${HELPER_DESTINATION}": "helper.sh" },\n`;

        const project = createCliProject({
            prefix: "gtkx-cli-deploy-symlink-",
            config: sourceConfig(PINNED_SOURCE, extra),
            files: npmSourceFiles(),
            hasStore: true,
        });

        try {
            symlinkSync(target, join(project.root, "helper.sh"));
            const env = { PATH: `${shim}:${process.env.PATH ?? ""}` };
            expect(runCli(project, SOURCE_ARGS, env).status).not.toBe(0);
        } finally {
            removeCliProject(project);
            rmSync(outside, { recursive: true, force: true });
            rmSync(shim, { recursive: true, force: true });
        }
    });

    it("fails when an extra file lives outside the checkout it builds from", () => {
        const shim = stubGenerator();
        const outside = mkdtempSync(join(tmpdir(), "gtkx-cli-deploy-outside-"));
        const source = join(outside, "helper.sh");
        writeFileSync(source, HELPER_SCRIPT);
        const extra = `        extraFiles: { "${HELPER_DESTINATION}": ${JSON.stringify(source)} },\n`;

        const project = createCliProject({
            prefix: "gtkx-cli-deploy-escape-",
            config: sourceConfig(PINNED_SOURCE, extra),
            files: npmSourceFiles(),
            hasStore: true,
        });

        try {
            const env = { PATH: `${shim}:${process.env.PATH ?? ""}` };
            expect(runCli(project, SOURCE_ARGS, env).status).not.toBe(0);
        } finally {
            removeCliProject(project);
            rmSync(outside, { recursive: true, force: true });
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

describe("gtkx deploy (third-party notices)", () => {
    const state = deployProbe({
        prefix: "gtkx-cli-deploy-notices-",
        config: config(NOTICES_BLOCK),
        files: noticesFiles(),
        args: ["deploy", "--print-manifests", "--target", TARGETS],
    });

    it("writes a machine-readable copyright with a stanza for everything the package carries", () => {
        const copyright = outputFile(state.project, COPYRIGHT_PATH);
        expect(state.status).toBe(0);
        expect(copyright).toContain(COPYRIGHT_FORMAT);
        expect(copyright).toContain(NODE_STANZA);
        expect(copyright).toContain(NATIVE_STANZA);
        expect(copyright).toContain(BUNDLE_STANZA);
        expect(copyright).toContain(GTKX_SOURCE);
        expect(copyright).toContain(MIT_SENTENCE);
        expect(copyright).toContain(PLATFORM_LIBRARY);
    });

    it("installs the notices on every target that carries no copyright file", () => {
        for (const target of NOTICE_TARGETS) {
            const notices = noticesFor(state.project, target);
            expect(notices).toContain(NOTICES_HEADING);
            expect(notices).toContain(MIT_SENTENCE);
            expect(notices).toContain(PLATFORM_SECTION);
            expect(notices).toContain(PLATFORM_SOURCE);
        }
    });

    it("keeps the build metadata it collects them from out of the package", () => {
        const staged = outputNames(state.project);
        expect(staged).not.toContain(join(STAGE_PREFIX, "lib", BINARY_NAME, PACKAGES_MANIFEST));
        expect(staged).toContain(join(STAGE_PREFIX, "lib", BINARY_NAME, "bundle.mjs"));
    });

    it("carries the license of the runtime it is pointed at", () => {
        expect(outputFile(state.project, COPYRIGHT_PATH)).toContain(NODE_LICENSE_TEXT);
        expect(noticesFor(state.project, "rpm")).toContain(NODE_LICENSE_TEXT);
    });

    it("lists a bundled dependency that declares no license at all", () => {
        const notices = noticesFor(state.project, "rpm");
        expect(notices).toContain(`${DEPENDENCY_NAME} ${DEPENDENCY_VERSION}`);
        expect(notices).toContain(UNDECLARED_LICENSE);
    });

    it("keeps the application's own terms on the file its own code is compiled into", () => {
        const bundle = stanzaFor(outputFile(state.project, COPYRIGHT_PATH), BUNDLE_STANZA.replace("Files: ", ""));
        expect(bundle).toContain(APPLICATION_STANZA);
        expect(bundle).toContain(`${DEPENDENCY_NAME} ${DEPENDENCY_VERSION}`);
    });
});

describe("gtkx deploy (a runtime with a license of its own)", () => {
    const state = deployProbe({
        prefix: "gtkx-cli-deploy-strange-runtime-",
        config: config(NOTICES_BLOCK),
        files: strangeRuntimeFiles(),
        args: ["deploy", "--print-manifests", "--target", "rpm"],
    });

    it("publishes no license beside the runtime that is not the runtime's", () => {
        expect(state.status).toBe(0);
        expect(noticesFor(state.project, "rpm")).not.toContain(OWN_LICENSE_TEXT);
    });
});

describe("gtkx deploy (a bundle with nothing third-party in it)", () => {
    const state = deployProbe({
        prefix: "gtkx-cli-deploy-bare-bundle-",
        config: config(DEPLOY_BLOCK),
        files: bareFiles(),
        args: ["deploy", "--print-manifests", "--target", "rpm"],
    });

    it("leaves out the dependency section rather than heading an empty one", () => {
        expect(state.status).toBe(0);
        expect(noticesFor(state.project, "rpm")).not.toContain(DEPENDENCY_SECTION);
    });
});

describe("gtkx deploy (a build whose packages have moved)", () => {
    it("still names a dependency whose recorded directory is gone", () => {
        const project = createCliProject({
            prefix: "gtkx-cli-deploy-moved-",
            config: config(NOTICES_BLOCK),
            files: noticesFiles(),
            hasStore: true,
        });

        try {
            expect(runCli(project, ["build"]).status).toBe(0);
            rmSync(join(project.root, "node_modules", DEPENDENCY_NAME), { recursive: true, force: true });
            const args = ["deploy", "--print-manifests", "--skip-build", "--target", "rpm"];
            expect(runCli(project, args).status).toBe(0);
            expect(noticesFor(project, "rpm")).toContain(`${DEPENDENCY_NAME} ${DEPENDENCY_VERSION}`);
        } finally {
            removeCliProject(project);
        }
    });
});

describe("gtkx deploy (a build it cannot account for)", () => {
    it("fails when the build it packages recorded no bundled packages", () => {
        const project = createCliProject({
            prefix: "gtkx-cli-deploy-stale-build-",
            config: config(DEPLOY_BLOCK),
            files: projectFiles(),
            hasStore: true,
        });

        try {
            expect(runCli(project, ["build"]).status).toBe(0);
            rmSync(join(project.root, "dist", PACKAGES_MANIFEST));
            const args = ["deploy", "--print-manifests", "--skip-build", "--target", "deb"];
            expect(runCli(project, args).status).not.toBe(0);
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

    it("fails over an extra file mode that is not octal", () => {
        const project = createCliProject({
            prefix: "gtkx-cli-deploy-mode-",
            config: config(BAD_MODE_BLOCK),
            files: projectFiles(),
            hasStore: true,
        });

        try {
            expect(runCli(project, ["deploy", "--print-manifests"]).status).not.toBe(0);
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

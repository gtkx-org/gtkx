import {
    chmodSync,
    existsSync,
    mkdtempSync,
    readFileSync,
    rmSync,
    statSync,
    writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, beforeAll, expect } from "vitest";
import { parse } from "yaml";
import {
    type CliProject,
    createCliProject,
    listProjectFiles,
    removeCliProject,
    runCli,
    runCliOrThrow,
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
type DeployProbe = { project: CliProject; status: number | null; output: string };

type BuildMetadata = {
    generator: string;
    formatVersion: number;
    schemas: string[];
    packages: { name: string; version: string | null; dir: string }[];
};

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
const SCHEMA_FILE = `${APPLICATION_ID}.gschema.xml`;
const STAGE_PREFIX = "stage/";
const BINARY_NAME = "gtkx-cli-deploy";
const MODULE_DIR = `/run/build/${BINARY_NAME}`;
const NODE_EXTENSION_DIR = "/usr/lib/sdk/node26";
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
const POT_CREATION_DATE = /^"POT-Creation-Date: .*\\n"$/m;
const STABLE_POT_CREATION_DATE = String.raw`"POT-Creation-Date: 1970-01-01 00:00+0000\n"`;
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

const SCHEMA_INSTALL =
    `install -Dm644 data/${SCHEMA_FILE} ${FLATPAK_DEST}/share/glib-2.0/schemas/${SCHEMA_FILE}`;

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
};

const SCHEMA = `<?xml version="1.0" encoding="UTF-8"?>
<schemalist>
    <schema id="${APPLICATION_ID}" path="/com/gtkx/clideploy/">
        <key name="probe" type="s"><default>'ready'</default></key>
    </schema>
</schemalist>
`;

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

const MIME_DESCRIPTION = "GTKX probe document";
const NEW_METADATA_MESSAGE = "Deployment utility";

const LOCALIZATION_PAYLOAD = `        genericName: "${NEW_METADATA_MESSAGE}",
        fileAssociations: [{
            extension: "probe",
            mimeType: "${MIME_TYPE}",
            description: "${MIME_DESCRIPTION}",
        }],
`;

const BAD_MODE = `        extraFiles: {
            "share/${BINARY_NAME}/notes.txt": { source: "tools/notes.txt", mode: "8" },
        },
`;

const MINIMUM_OVERRIDES = `        minimumLibraryVersions: { "Gtk-4.0": "4.14" },
`;

const FOREIGN_INVENTORY = `${JSON.stringify({ libraries: ["Adw-1"], versions: [] }, null, 2)}\n`;
const DEPLOY_BLOCK = `    deploy: {\n${DEPLOY_FIELDS}\n${EXTRA_FILES}${PERMISSIONS}    },\n`;
const LOCALIZED_DEPLOY_BLOCK = `    deploy: {\n${DEPLOY_FIELDS}\n${LOCALIZATION_PAYLOAD}    },\n`;
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
import schema from "../data/${SCHEMA_FILE}";

createRoot().render(
    <GtkApplication>
        <GtkApplicationWindow title="Probe">
            <GtkLabel label={String(schema.id)} />
        </GtkApplicationWindow>
    </GtkApplication>,
);
`;

const EXPECTED_STAGED = [
    join(STAGE_PREFIX, "bin", BINARY_NAME),
    join(STAGE_PREFIX, "lib", BINARY_NAME, "bundle.mjs"),
    join(STAGE_PREFIX, "lib", BINARY_NAME, "gschemas.compiled"),
    join(STAGE_PREFIX, "lib", BINARY_NAME, "gtkx.node"),
    join(STAGE_PREFIX, "share", "applications", `${APPLICATION_ID}.desktop`),
    join(STAGE_PREFIX, "share", "icons", "hicolor", "scalable", "apps", `${APPLICATION_ID}.svg`),
    join(STAGE_PREFIX, "share", "glib-2.0", "schemas", SCHEMA_FILE),
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
const BUILD_METADATA = "gtkx-schemas.json";
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

const LOCALE_INSTALL =
    `test ! -d dist/locale || { mkdir -p ${FLATPAK_DEST}/share/locale && ` +
    `cp -a dist/locale/. ${FLATPAK_DEST}/share/locale/; }`;

const FRENCH_NAME = "Sonde de déploiement";
const GERMAN_NAME = "Bereitstellungsprüfung";
const FRENCH_SUMMARY = "Vérifie les fichiers produits par le déploiement";
const GERMAN_SUMMARY = "Prüft die vom Bereitstellen erzeugten Dateien";
const FRENCH_MIME_DESCRIPTION = "Document de sonde GTKX";
const GERMAN_MIME_DESCRIPTION = "GTKX-Prüfdokument";
const STALE_SOURCE_MESSAGE = "A source message removed after deploy";
const METADATA_SENTINEL = join("po", ".gtkx-metadata", "keep.txt");
const FRENCH_CATALOG = join("po", "fr.po");
const GERMAN_CATALOG = join("po", "de.po");
const ITALIAN_CATALOG = join("po", "it.po");

const LOCALIZED_APP_SOURCE = `import { t } from "@gtkx/i18n";
${APP_SOURCE}
process.env.STALE_TRANSLATION = t("${STALE_SOURCE_MESSAGE}");
`;

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

const poCatalog = (language: string, translations: [string, string][]): string => [
    'msgid ""',
    'msgstr ""',
    String.raw`"Project-Id-Version: GTKX test catalog\n"`,
    String.raw`"PO-Revision-Date: 1970-01-01 00:00+0000\n"`,
    String.raw`"Last-Translator: GTKX Test\n"`,
    String.raw`"Language-Team: ${language}\n"`,
    String.raw`"Language: ${language}\n"`,
    String.raw`"MIME-Version: 1.0\n"`,
    String.raw`"Content-Type: text/plain; charset=UTF-8\n"`,
    String.raw`"Content-Transfer-Encoding: 8bit\n"`,
    "",
    ...translations.flatMap(([message, translation]) => [
        `msgid ${JSON.stringify(message)}`,
        `msgstr ${JSON.stringify(translation)}`,
        "",
    ]),
].join("\n");

const config = (body: string, applicationIcon: string | null = "data/icons"): string =>
    `export default {\n    applicationId: "${APPLICATION_ID}",\n` +
    `    libraries: ${JSON.stringify(STORE_LIBRARIES)},\n` +
    (applicationIcon === null ? "" : `    applicationIcon: ${JSON.stringify(applicationIcon)},\n`) +
    `${body}};\n`;

const bareConfig = (body: string): string =>
    `export default {\n    applicationId: "${APPLICATION_ID}",\n` +
    "    applicationIcon: \"data/icons\",\n" +
    `${body}};\n`;

const sourceConfig = (source: string, extra = ""): string =>
    config(
        `    deploy: {\n${DEPLOY_FIELDS}\n${extra}` +
        `        flatpak: { mode: "source", source: ${source} },\n    },\n`,
    );

const projectFiles = (): Record<string, string> => ({
    "package.json": `${JSON.stringify(MANIFEST, null, 4)}\n`,
    LICENSE: "Mozilla Public License Version 2.0\n",
    [join("data", ICON_PATH)]: "<svg/>\n",
    [join("data", SCHEMA_FILE)]: SCHEMA,
    [join("src", "index.tsx")]: APP_SOURCE,
    [HELPER_SOURCE]: HELPER_SCRIPT,
    [NOTES_SOURCE]: NOTES,
});

const localizedFiles = (files: Record<string, string>): Record<string, string> => ({
    ...files,
    [join("src", "index.tsx")]: LOCALIZED_APP_SOURCE,
    [METADATA_SENTINEL]: "keep\n",
    [join("po", "LINGUAS")]: "fr de it\n",
    [join("po", "fr.po")]: poCatalog("fr", [
        ["Deploy Probe", FRENCH_NAME],
        ["Probes what the deploy command writes", FRENCH_SUMMARY],
        [MIME_DESCRIPTION, FRENCH_MIME_DESCRIPTION],
    ]),
    [join("po", "de.po")]: poCatalog("de", [
        ["Deploy Probe", GERMAN_NAME],
        ["Probes what the deploy command writes", GERMAN_SUMMARY],
        [MIME_DESCRIPTION, GERMAN_MIME_DESCRIPTION],
    ]),
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

const expectUnlocalizedMetadata = (project: CliProject): void => {
    const desktop = outputFile(project, join("stage", "share", "applications", `${APPLICATION_ID}.desktop`));
    const metainfo = outputFile(project, join("stage", "share", "metainfo", `${APPLICATION_ID}.metainfo.xml`));
    expect(desktop).toContain("Name=Deploy Probe");
    expect(desktop).not.toContain("Name[");
    expect(metainfo).toContain("<name>Deploy Probe</name>");
    expect(metainfo).not.toContain("xml:lang=");
};

const expectMetadataMessages = (project: CliProject): void => {
    const template = readFileSync(join(project.root, "po", `${APPLICATION_ID}.pot`), "utf8");
    expect(template).toContain('msgid "Deploy Probe"');
    expect(template).toContain('msgid "Probes what the deploy command writes"');
    expect(template).toContain(`msgid "${MIME_DESCRIPTION}"`);
    expect(template).toContain(join("po", ".gtkx-metadata", `${APPLICATION_ID}.template.desktop`));
    expect(template).not.toContain("gtkx-deploy-metadata-");
};

const expectSynchronizedCatalog = (project: CliProject): void => {
    const catalog = readFileSync(join(project.root, FRENCH_CATALOG), "utf8");
    expect(catalog).toContain(`msgid ${JSON.stringify(STALE_SOURCE_MESSAGE)}`);
    expect(catalog).toContain(`msgid ${JSON.stringify(NEW_METADATA_MESSAGE)}`);
    expect(catalog).toContain(`msgstr ${JSON.stringify(FRENCH_NAME)}`);
};

const expectInitializedDeployCatalog = (project: CliProject): void => {
    const catalog = readFileSync(join(project.root, ITALIAN_CATALOG), "utf8");
    expect(catalog).toContain(String.raw`"Language: it\n"`);
    expect(catalog).toContain(`msgid ${JSON.stringify(STALE_SOURCE_MESSAGE)}`);
    expect(catalog).toContain(`msgid ${JSON.stringify(NEW_METADATA_MESSAGE)}`);
};

const stabilizePotCreationDate = (path: string): void => {
    const catalog = readFileSync(path, "utf8");
    expect(catalog).toMatch(POT_CREATION_DATE);
    writeFileSync(path, catalog.replace(POT_CREATION_DATE, () => STABLE_POT_CREATION_DATE));
};

const expectCatalogRedeployIsStable = (project: CliProject): void => {
    const templatePath = join(project.root, "po", `${APPLICATION_ID}.pot`);
    const frenchPath = join(project.root, FRENCH_CATALOG);
    const germanPath = join(project.root, GERMAN_CATALOG);
    const italianPath = join(project.root, ITALIAN_CATALOG);

    for (const path of [templatePath, frenchPath, germanPath, italianPath]) {
        stabilizePotCreationDate(path);
    }

    const template = readFileSync(templatePath);
    const french = readFileSync(frenchPath);
    const german = readFileSync(germanPath);
    const italian = readFileSync(italianPath);
    runCliOrThrow(project, ["deploy", "--print-manifests", "--target", "deb"]);
    expect(readFileSync(templatePath).equals(template)).toBe(true);
    expect(readFileSync(frenchPath).equals(french)).toBe(true);
    expect(readFileSync(germanPath).equals(german)).toBe(true);
    expect(readFileSync(italianPath).equals(italian)).toBe(true);
};

const expectLocalizedDeploy = (state: DeployProbe): void => {
    expectSuccessfulDeploy(state);

    const desktop = outputFile(
        state.project,
        join("stage", "share", "applications", `${APPLICATION_ID}.desktop`),
    );

    const metainfo = outputFile(
        state.project,
        join("stage", "share", "metainfo", `${APPLICATION_ID}.metainfo.xml`),
    );

    const mime = outputFile(state.project, join("stage", "share", "mime", "packages", MIME_FILENAME));
    const launcher = outputFile(state.project, join("stage", "bin", BINARY_NAME));
    const written = outputNames(state.project);
    expect(desktop).toContain(`Name[fr]=${FRENCH_NAME}`);
    expect(desktop).toContain(`Name[de]=${GERMAN_NAME}`);
    expect(metainfo).toContain(`<name xml:lang="fr">${FRENCH_NAME}</name>`);
    expect(metainfo).toContain(`<name xml:lang="de">${GERMAN_NAME}</name>`);
    expect(mime).toContain(`<comment xml:lang="fr">${FRENCH_MIME_DESCRIPTION}</comment>`);
    expect(mime).toContain(`<comment xml:lang="de">${GERMAN_MIME_DESCRIPTION}</comment>`);

    expect(written).toEqual(expect.arrayContaining([
        join("stage", "share", "locale", "fr", "LC_MESSAGES", `${APPLICATION_ID}.mo`),
        join("stage", "share", "locale", "de", "LC_MESSAGES", `${APPLICATION_ID}.mo`),
        join("stage", "share", "locale", "it", "LC_MESSAGES", `${APPLICATION_ID}.mo`),
    ]));

    expect(written.some((name) => name.startsWith(join("stage", "lib", BINARY_NAME, "locale")))).toBe(false);
    expect(launcher).toContain('GTKX_LOCALE_DIR="$prefix/share/locale"\nexport GTKX_LOCALE_DIR');
    expectMetadataMessages(state.project);
    expectInitializedDeployCatalog(state.project);

    expect(readFileSync(join(state.project.root, "po", `${APPLICATION_ID}.pot`), "utf8")).toContain(
        STALE_SOURCE_MESSAGE,
    );

    expect(readFileSync(join(state.project.root, METADATA_SENTINEL), "utf8")).toBe("keep\n");
    expectSynchronizedCatalog(state.project);
    expectCatalogRedeployIsStable(state.project);
};

const expectPlainBuildPreservesMetadata = (project: CliProject): void => {
    const sourcePath = join(project.root, "src", "index.tsx");
    writeFileSync(sourcePath, APP_SOURCE);

    try {
        expect(runCli(project, ["build"]).status).toBe(0);
        const template = readFileSync(join(project.root, "po", `${APPLICATION_ID}.pot`), "utf8");
        expectMetadataMessages(project);
        expect(template).not.toContain(STALE_SOURCE_MESSAGE);
    } finally {
        writeFileSync(sourcePath, LOCALIZED_APP_SOURCE);
    }
};

const expectRedeployDropsRemovedMetadata = (project: CliProject): void => {
    const configPath = join(project.root, "gtkx.config.ts");
    const templatePath = join(project.root, "po", `${APPLICATION_ID}.pot`);
    stabilizePotCreationDate(templatePath);
    writeFileSync(configPath, config(DEPLOY_BLOCK));

    try {
        expect(runCli(project, ["deploy", "--print-manifests", "--target", "deb"]).status).toBe(0);
        const template = readFileSync(templatePath, "utf8");
        expect(template).toContain('msgid "Deploy Probe"');
        expect(template).not.toContain(MIME_DESCRIPTION);
        expect(template).not.toContain(STABLE_POT_CREATION_DATE);
    } finally {
        writeFileSync(configPath, config(LOCALIZED_DEPLOY_BLOCK));
    }
};

const expectSkipBuildPreservesPot = (project: CliProject): void => {
    const path = join(project.root, "po", `${APPLICATION_ID}.pot`);
    const original = readFileSync(path, "utf8");
    const catalogPath = join(project.root, FRENCH_CATALOG);
    const catalog = readFileSync(catalogPath, "utf8");
    const compiled = join(project.root, "dist", "locale", "fr", "LC_MESSAGES", `${APPLICATION_ID}.mo`);
    const sentinel = "catalog template must stay untouched\n";
    writeFileSync(path, sentinel);
    rmSync(compiled, { force: true });

    try {
        expect(runCli(project, ["deploy", "--print-manifests", "--skip-build", "--target", "deb"]).status).toBe(0);
        expect(readFileSync(path, "utf8")).toBe(sentinel);
        expect(readFileSync(catalogPath, "utf8")).toBe(catalog);
        expect(existsSync(compiled)).toBe(true);
    } finally {
        writeFileSync(path, original);
    }
};

const expectMalformedCatalogFailure = (): void => {
    const project = createCliProject({
        prefix: "gtkx-cli-deploy-malformed-catalog-",
        config: config(LOCALIZED_DEPLOY_BLOCK),
        files: {
            ...localizedFiles(projectFiles()),
            [join("po", "fr.po")]: "this is not a gettext catalog\n",
        },
        hasStore: true,
    });

    try {
        expect(() => runCliOrThrow(project, ["deploy", "--print-manifests", "--target", "deb"])).toThrow();
    } finally {
        removeCliProject(project);
    }
};

const expectMissingSkipCatalogFailure = (): void => {
    const project = createCliProject({
        prefix: "gtkx-cli-deploy-missing-skip-catalog-",
        config: config(LOCALIZED_DEPLOY_BLOCK),
        files: {
            ...localizedFiles(projectFiles()),
            [join("po", `${APPLICATION_ID}.pot`)]: "catalog template must stay untouched\n",
        },
        hasStore: true,
    });

    try {
        const args = ["deploy", "--print-manifests", "--skip-build", "--target", "deb"];
        expect(() => runCliOrThrow(project, args)).toThrow();
    } finally {
        removeCliProject(project);
    }
};

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
    const probe: DeployProbe = { project: { root: "", nodeModules: "" }, status: null, output: "" };

    beforeAll(() => {
        probe.project = createCliProject({ ...options, hasStore: true });

        for (const name of executables) {
            chmodSync(join(probe.project.root, name), 0o755);
        }

        const run = runCli(probe.project, args);
        probe.status = run.status;
        probe.output = run.output;
    });

    afterAll(() => {
        removeCliProject(probe.project);
    });

    return probe;
};

const expectSuccessfulDeploy = (probe: DeployProbe): void => {
    if (probe.status !== 0) {
        throw new Error(probe.output);
    }

    expect(probe.status).toBe(0);
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

export {
    APPEND_PATH,
    APPLICATION_ID,
    APPLICATION_STANZA,
    BAD_MODE_BLOCK,
    bareConfig,
    bareFiles,
    BINARY_NAME,
    BUILD_METADATA,
    type BuildMetadata,
    BUNDLE_STANZA,
    COMMIT_PATTERN,
    config,
    COPYRIGHT_FORMAT,
    COPYRIGHT_PATH,
    DEFAULT_CLEANUP,
    DEFAULT_FINISH_ARGS,
    DEPENDENCY_NAME,
    DEPENDENCY_SECTION,
    DEPENDENCY_VERSION,
    DEPLOY_BLOCK,
    deployProbe,
    EXPECTED_MANIFESTS,
    EXPECTED_STAGED,
    expectLocalizedDeploy,
    expectMalformedCatalogFailure,
    expectMissingSkipCatalogFailure,
    expectPlainBuildPreservesMetadata,
    expectRedeployDropsRemovedMetadata,
    expectRefusal,
    expectSkipBuildPreservesPot,
    expectSuccessfulDeploy,
    expectUnlocalizedMetadata,
    findInlineSource,
    findSource,
    flatpakManifest,
    flatpakModule,
    FOREIGN_INVENTORY,
    FRENCH_MIME_DESCRIPTION,
    FRENCH_NAME,
    GENERATED_SOURCES,
    GERMAN_NAME,
    GTKX_SOURCE,
    HELPER_DESTINATION,
    HELPER_INSTALL,
    HELPER_PACKAGE_PATH,
    HELPER_SCRIPT,
    HELPER_SOURCE,
    LIBRARIES_INVENTORY,
    LICENSE_INSTALL,
    LOCALE_INSTALL,
    LOCALIZATION_PAYLOAD,
    LOCALIZED_DEPLOY_BLOCK,
    localizedFiles,
    MERGED_NEGATIONS,
    MIME_FILENAME,
    MIME_INSTALL,
    MIME_TYPE,
    MINIMUMS_BLOCK,
    MIT_SENTENCE,
    NATIVE_STANZA,
    NFPM_PATH,
    NODE_EXTENSION_PATH,
    NODE_LICENSE_TEXT,
    NODE_STANZA,
    NO_DISPLAY_BLOCK,
    NOTES_DESTINATION,
    NOTICES_BLOCK,
    NOTICES_FILENAME,
    noticesFiles,
    noticesFor,
    NOTICES_HEADING,
    NOTICES_INSTALL,
    NOTICE_TARGETS,
    NPM_INSTALL,
    npmSourceFiles,
    OUT_DIR,
    outputFile,
    outputNames,
    OWN_LICENSE_TEXT,
    packagedDepends,
    packagedMode,
    PINNED_SOURCE,
    PLATFORM_LIBRARY,
    PLATFORM_SECTION,
    PLATFORM_SOURCE,
    PNPM_INSTALL,
    PNPM_PIN,
    PNPM_SHA512,
    PNPM_TARBALL,
    PNPM_VERSION,
    projectFiles,
    RPM_NFPM_PATH,
    SCHEMA,
    SCHEMA_INSTALL,
    SECRET_DESTINATION,
    SOURCE_ARGS,
    sourceConfig,
    sourceFiles,
    SOURCE_PAYLOAD,
    SOURCE_TAG,
    stagedMode,
    STAGE_PREFIX,
    stanzaFor,
    strangeRuntimeFiles,
    stubGenerator,
    TAGGED_SOURCE,
    TARGETS,
    UNDECLARED_LICENSE,
};

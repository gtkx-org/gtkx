import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { parse } from "yaml";
import { type CliProject, createCliProject, removeCliProject, runCliOrThrow } from "./cli-project.js";
import {
    APPLICATION_ID,
    BINARY_NAME,
    config,
    HELPER_SOURCE,
    NFPM_PATH,
    NOTES_DESTINATION,
    outputFile,
    projectFiles,
    RPM_NFPM_PATH,
    stagedMode,
} from "./deploy-helpers.js";

type NfpmContent = { dst: string; type?: string };
type NfpmConfig = { contents: NfpmContent[]; depends: string[] };

const HIGH_GLIBC_VERSION = "GLIBC_9.99";
const EXTRA_ELF = "compatibility-probe.node";
const NOTES_SOURCE = "tools/notes.txt";
const NATIVE_BINARY = fileURLToPath(new URL(`../../native/native.linux-${process.arch}-gnu.node`, import.meta.url));
const APP_OWNED_DIRECTORY = `/usr/libexec/${BINARY_NAME}`;

const SYSTEM_DIRECTORIES = [
    "/usr/libexec",
    "/usr/lib/systemd",
    "/usr/lib/systemd/system",
    "/usr/lib/systemd/user",
    "/usr/share/polkit-1",
    "/usr/share/polkit-1/actions",
    "/usr/share/dbus-1/system.d",
    "/usr/share/dbus-1/system-services",
];

const METAINFO_EXTRA = [
    `<translation type="gettext">${APPLICATION_ID}</translation>`,
    '<recommends><display_length compare="ge">360</display_length></recommends>',
    "<supports><control>keyboard</control><control>pointing</control></supports>",
    `<provides><dbus type="user">${APPLICATION_ID}</dbus></provides>`,
    '<custom><value key="GTKX::DeployProbe">enabled</value></custom>',
];

const EXPECTED_METAINFO = [
    ...METAINFO_EXTRA.filter((fragment) => !fragment.startsWith("<provides>")),
    `<dbus type="user">${APPLICATION_ID}</dbus>`,
];

const EXTRA_FILES = {
    [`lib/${BINARY_NAME}/${EXTRA_ELF}`]: EXTRA_ELF,
    [`libexec/${BINARY_NAME}/helper`]: { source: HELPER_SOURCE, mode: "0755" },
    [`lib/systemd/system/${BINARY_NAME}.service`]: NOTES_SOURCE,
    [`lib/systemd/user/${BINARY_NAME}.service`]: NOTES_SOURCE,
    [`share/polkit-1/actions/${APPLICATION_ID}.policy`]: NOTES_SOURCE,
    [`share/dbus-1/system.d/${APPLICATION_ID}.conf`]: NOTES_SOURCE,
    [`share/dbus-1/system-services/${APPLICATION_ID}.service`]: NOTES_SOURCE,
    [`share/metainfo/${APPLICATION_ID}.metainfo.xml`]: NOTES_SOURCE,
};

const deployBlock = (extra: string): string => `    deploy: {
        name: "Deploy Probe",
        summary: "Probes deployment metadata and packaging safety",
        description: ["A probe application for deployment metadata and packaging safety."],
        categories: ["Utility"],
        developer: { name: "GTKX", email: "hello@gtkx.dev" },
        homepage: "https://gtkx.dev",
        license: "MPL-2.0",
${extra}    },
`;

const successfulConfig = (): string => config(deployBlock(
    `        metainfoExtra: ${JSON.stringify(METAINFO_EXTRA)},
        extraFiles: ${JSON.stringify(EXTRA_FILES)},
`,
));

const nfpmConfig = (project: CliProject, path: string): NfpmConfig =>
    parse(outputFile(project, path)) as NfpmConfig;

const highFloorElf = (): Buffer => {
    const binary = readFileSync(NATIVE_BINARY);
    const versions = binary.toString("latin1").match(/GLIBC_\d+\.\d+/g) ?? [];
    const replacementLength = Buffer.byteLength(HIGH_GLIBC_VERSION);
    const replaceable = versions.find((version) => Buffer.byteLength(version) === replacementLength);

    if (replaceable === undefined) {
        throw new Error("The test Node.js binary has no replaceable GLIBC version");
    }

    let offset = binary.indexOf(replaceable);

    while (offset !== -1) {
        binary.set(Buffer.from(HIGH_GLIBC_VERSION), offset);
        offset = binary.indexOf(replaceable, offset + HIGH_GLIBC_VERSION.length);
    }

    return binary;
};

const projectConfig = (extra: string): string => config(deployBlock(extra));

const extraFileConfig = (source: string, mode?: string): string => {
    const entry = mode === undefined ? JSON.stringify(source) : JSON.stringify({ source, mode });
    const extra = `        extraFiles: { ${JSON.stringify(NOTES_DESTINATION)}: ${entry} },\n`;

    return projectConfig(extra);
};

const expectDeployRejected = (prefix: string, projectConfiguration: string): void => {
    using project = createCliProject({
        prefix,
        config: projectConfiguration,
        files: projectFiles(),
        hasStore: true,
    });

    expect(() => runCliOrThrow(project, ["deploy", "--print-manifests", "--target", "deb"])).toThrow();
};

describe("gtkx deploy (metadata and packaging safety)", () => {
    let project: CliProject;

    beforeAll(() => {
        project = createCliProject({
            prefix: "gtkx-cli-deploy-metadata-safety-",
            config: successfulConfig(),
            files: projectFiles(),
            hasStore: true,
        });
        writeFileSync(join(project.root, EXTRA_ELF), highFloorElf());
        runCliOrThrow(project, ["deploy", "--print-manifests", "--target", "deb,rpm"]);
    });

    afterAll(() => {
        removeCliProject(project);
    });

    it("derives the libc dependency from every staged ELF", () => {
        expect(nfpmConfig(project, NFPM_PATH).depends).toContain("libc6 (>= 9.99)");
        expect(nfpmConfig(project, RPM_NFPM_PATH).depends).toContain("glibc >= 9.99");
    });

    it("merges AppStream fragments before validating and staging metainfo", () => {
        const metainfo = outputFile(
            project,
            join("stage", "share", "metainfo", `${APPLICATION_ID}.metainfo.xml`),
        );

        for (const fragment of EXPECTED_METAINFO) {
            expect(metainfo).toContain(fragment);
        }
    });

    it("accepts a safe four-digit mode without preserving privileged bits", () => {
        expect(stagedMode(project, `${APP_OWNED_DIRECTORY.slice("/usr/".length)}/helper`)).toBe(0o755);
    });

    it("leaves system integration directories to their owning rpm packages", () => {
        const directories = nfpmConfig(project, RPM_NFPM_PATH).contents
            .filter((entry) => entry.type === "dir")
            .map((entry) => entry.dst);

        expect(directories).not.toEqual(expect.arrayContaining(SYSTEM_DIRECTORIES));
        expect(directories).toContain(APP_OWNED_DIRECTORY);
    });
});

describe("gtkx deploy (invalid metadata and extra files)", () => {
    it("rejects malformed AppStream fragments", () => {
        expectDeployRejected(
            "gtkx-cli-deploy-malformed-metainfo-extra-",
            projectConfig('        metainfoExtra: ["<custom>"],\n'),
        );
    });

    it("rejects setuid and setgid extra file modes", () => {
        for (const mode of ["2755", "4755", "6755"]) {
            expectDeployRejected(`gtkx-cli-deploy-privileged-mode-${mode}-`, extraFileConfig(NOTES_SOURCE, mode));
        }
    });

    it("rejects a missing extra file source before deployment", () => {
        expectDeployRejected("gtkx-cli-deploy-missing-extra-source-", extraFileConfig("missing.txt"));
    });
});

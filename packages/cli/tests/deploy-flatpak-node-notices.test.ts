import { chmodSync, copyFileSync, mkdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { describe, expect, it } from "vitest";
import { parse } from "yaml";
import { createCliProject, runCliOrThrow } from "./cli-project.js";

const APPLICATION_ID = "org.gtkx.sdknotices";
const BINARY_NAME = "gtkx-sdk-notices";
const MANIFEST = { name: BINARY_NAME, version: "1.0.0", type: "module" };
const LOCAL_LICENSE = "Node.js local runtime license terms\n";
const LOCAL_NODE = 'node: { source: "path", path: "runtime/node" },';
const SDK_EXTENSION = "org.freedesktop.Sdk.Extension.node26";

type FlatpakManifest = {
    "sdk-extensions": string[];
    modules: {
        "build-commands": string[];
        sources: { "dest-filename"?: string; contents?: string }[];
    }[];
};

const config = (node: string, flatpak = 'mode: "source",'): string => `export default {
    applicationId: "${APPLICATION_ID}",
    applicationIcon: "application.svg",
    codegen: false,
    deploy: {
        name: "SDK Notices",
        binaryName: "${BINARY_NAME}",
        developer: { name: "GTKX" },
        summary: "Exercises SDK runtime notices",
        description: ["An application that exercises the native runtime selected by source Flatpak packaging."],
        categories: ["Utility"],
        homepage: "https://gtkx.dev",
        license: "MPL-2.0",
        metadataLicense: "CC0-1.0",
        ${node}
        flatpak: {
            ${flatpak}
            source: {
                url: "https://github.com/gtkx-org/cli-deploy-probe.git",
                commit: "4c1d0f7b2a9e5c38f61b0d47ae92c5138b7ff204",
            },
        },
    },
};\n`;

const files = (): Record<string, string> => ({
    "application.svg": '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16"/>\n',
    "src/index.ts": 'process.stdout.write("SDK notices");\n',
    "runtime/LICENSE": LOCAL_LICENSE,
    "package.json": JSON.stringify(MANIFEST),
    "package-lock.json": JSON.stringify({
        ...MANIFEST,
        lockfileVersion: 3,
        packages: { "": MANIFEST },
    }),
});

const readFlatpak = (root: string): FlatpakManifest => parse(readFileSync(
    join(root, "build", process.arch, "targets/flatpak", `${APPLICATION_ID}.yml`),
    "utf8",
)) as FlatpakManifest;

const readFlatpakNotices = (root: string): string => readFileSync(
    join(root, "build", process.arch, "overlay/flatpak/share/licenses", BINARY_NAME, "THIRD-PARTY-NOTICES"),
    "utf8",
);

const installLocalNode = (root: string): void => {
    const path = join(root, "runtime/node");
    mkdirSync(dirname(path), { recursive: true });
    copyFileSync(process.execPath, path);
    chmodSync(path, 0o755);
};

describe("source Flatpak runtime notices", () => {
    it.each([
        ["default download", ""],
        ["missing local path", 'node: { source: "path", path: "missing-node" },'],
        ["mismatched host version", 'node: { source: "host", version: "99.0.0" },'],
        ["unsupported download version", 'node: { source: "download", version: "1.0.0" },'],
    ])("uses the SDK runtime with %s configuration", (_title, node) => {
        using project = createCliProject({
            prefix: "gtkx-sdk-notices-",
            config: config(node),
            files: files(),
            hasStore: true,
        });
        runCliOrThrow(project, ["deploy", "--print-manifests", "--target", "flatpak"]);
        const manifest = readFlatpak(project.root);
        const notices = readFlatpakNotices(project.root);
        expect(manifest.modules.flatMap((module) => module["build-commands"]))
            .toContain(`install -Dm755 /usr/lib/sdk/node26/bin/node \${FLATPAK_DEST}/lib/${BINARY_NAME}/node`);
        expect(notices).toContain(`Node.js (${SDK_EXTENSION})`);
        expect(notices).not.toContain(`Node.js ${process.versions.node}`);
        expect(notices).not.toContain(LOCAL_LICENSE.trim());
        expect(manifest.modules.flatMap((module) => module.sources)
            .find((source) => source["dest-filename"] === "THIRD-PARTY-NOTICES")?.contents).toContain(notices);
    });

    it("identifies the configured SDK extension without guessing its release", () => {
        const extension = "org.freedesktop.Sdk.Extension.node26-audit";
        using project = createCliProject({
            prefix: "gtkx-sdk-notices-extension-",
            config: config("", `mode: "source", nodeExtension: "${extension}",`),
            files: files(),
            hasStore: true,
        });
        runCliOrThrow(project, ["deploy", "--print-manifests", "--target", "flatpak"]);
        const manifest = readFlatpak(project.root);
        expect(manifest["sdk-extensions"]).toContain(extension);
        expect(manifest.modules.flatMap((module) => module["build-commands"]))
            .toContain(`install -Dm755 /usr/lib/sdk/node26-audit/bin/node \${FLATPAK_DEST}/lib/${BINARY_NAME}/node`);
        expect(readFlatpakNotices(project.root)).toContain(`Node.js (${extension})`);
    });

    it.each(["deb", "deb,flatpak"])("retains the selected local runtime for %s", (target) => {
        using project = createCliProject({
            prefix: "gtkx-sdk-notices-local-",
            config: config(LOCAL_NODE),
            files: files(),
            hasStore: true,
        });
        installLocalNode(project.root);
        runCliOrThrow(project, ["deploy", "--print-manifests", "--target", target]);
        const debNotices = readFileSync(
            join(project.root, "build", process.arch, "overlay/deb/share/doc", BINARY_NAME, "copyright"),
            "utf8",
        );
        expect(debNotices).toContain(`Node.js ${process.versions.node}`);
        expect(debNotices).toContain(LOCAL_LICENSE.trim());
        expect(debNotices).not.toContain(SDK_EXTENSION);
    });

    it("uses SDK runtime notices when local-runtime targets are also selected", () => {
        using project = createCliProject({
            prefix: "gtkx-sdk-notices-mixed-",
            config: config(LOCAL_NODE),
            files: files(),
            hasStore: true,
        });
        installLocalNode(project.root);
        runCliOrThrow(project, ["deploy", "--print-manifests", "--target", "deb,flatpak"]);
        const notices = readFlatpakNotices(project.root);
        expect(notices).toContain(`Node.js (${SDK_EXTENSION})`);
        expect(notices).not.toContain(LOCAL_LICENSE.trim());
        expect(readFlatpak(project.root).modules.flatMap((module) => module.sources)
            .find((source) => source["dest-filename"] === "THIRD-PARTY-NOTICES")?.contents).toContain(notices);
    });

    it("retains local runtime notices for a binary Flatpak", () => {
        using project = createCliProject({
            prefix: "gtkx-binary-notices-",
            config: config(LOCAL_NODE, 'mode: "prebuilt",'),
            files: files(),
            hasStore: true,
        });
        installLocalNode(project.root);
        runCliOrThrow(project, ["deploy", "--print-manifests", "--target", "flatpak"]);
        const notices = readFlatpakNotices(project.root);
        expect(notices).toContain(`Node.js ${process.versions.node}`);
        expect(notices).toContain(LOCAL_LICENSE.trim());
        expect(notices).not.toContain(SDK_EXTENSION);
    });

    it.each(["deb", "deb,flatpak"])("rejects a missing local runtime required by %s", (target) => {
        using project = createCliProject({
            prefix: "gtkx-sdk-notices-missing-",
            config: config(LOCAL_NODE),
            files: files(),
            hasStore: true,
        });
        expect(() => runCliOrThrow(project, ["deploy", "--print-manifests", "--target", target])).toThrow();
    });

    it("rejects an invalid SDK extension", () => {
        using project = createCliProject({
            prefix: "gtkx-sdk-notices-invalid-",
            config: config("", 'mode: "source", nodeExtension: "org.gtkx.Invalid",'),
            files: files(),
            hasStore: true,
        });
        expect(() => runCliOrThrow(project, ["deploy", "--print-manifests", "--target", "flatpak"])).toThrow();
    });
});

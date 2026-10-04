import { DEFAULT_NODE_VERSION, MINIMUM_NODE_VERSION } from "@gtkx/config/internal";
import { chmodSync, copyFileSync, mkdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { describe, expect, it } from "vitest";
import { createCliProject, runCliOrThrow } from "./cli-project.js";

const APPLICATION_ID = "com.gtkx.deploynodeversion";
const BINARY_NAME = "gtkx-node-version-probe";
const PATH_NODE = join("runtime", "node");

const deployConfig = (node: string): string => `export default {
    applicationId: "${APPLICATION_ID}",
    applicationIcon: "application.svg",
    codegen: false,
    deploy: {
        name: "Node Version Probe",
        binaryName: "${BINARY_NAME}",
        developer: { name: "GTKX" },
        summary: "Exercises deployed Node.js version reporting",
        description: ["An integration probe for the Node.js runtime selected during deployment."],
        categories: ["Utility"],
        license: "MPL-2.0",
        metadataLicense: "CC0-1.0",
        node: ${node},
    },
};
`;

const projectFiles = (): Record<string, string> => ({
    "application.svg": '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16"/>\n',
    [join("src", "index.ts")]: 'process.stdout.write("application");\n',
});

const deploy = (node: string, runtimeMode?: number): string => {
    using project = createCliProject({
        prefix: "gtkx-deploy-node-version-",
        config: deployConfig(node),
        files: projectFiles(),
        hasStore: true,
    });

    if (runtimeMode !== undefined) {
        const path = join(project.root, PATH_NODE);
        mkdirSync(dirname(path), { recursive: true });
        copyFileSync(process.execPath, path);
        chmodSync(path, runtimeMode);
    }

    runCliOrThrow(project, ["deploy", "--print-manifests", "--target", "deb"]);

    return readFileSync(
        join(project.root, "build", process.arch, "overlay", "deb", "share", "doc", BINARY_NAME, "copyright"),
        "utf8",
    );
};

describe("gtkx deploy Node.js runtime versions", () => {
    it("reports the actual host runtime version", () => {
        expect(deploy('{ source: "host" }')).toContain(`Node.js ${process.versions.node}`);
    });

    it.each([undefined, process.versions.node, ` v${process.versions.node} `])(
        "probes a real runtime at a relative path with expected version %s",
        (version) => {
            const node = JSON.stringify({ source: "path", path: PATH_NODE, version });

            expect(deploy(node, 0o755)).toContain(`Node.js ${process.versions.node}`);
        },
    );

    it.each([
        [undefined, DEFAULT_NODE_VERSION],
        [MINIMUM_NODE_VERSION, MINIMUM_NODE_VERSION],
        [` v${MINIMUM_NODE_VERSION} `, MINIMUM_NODE_VERSION],
        ["26.7.1", "26.7.1"],
        ["26.8.0", "26.8.0"],
        ["27.0.0", "27.0.0"],
    ])("reports a supported download version %s", (version, expected) => {
        expect(deploy(JSON.stringify({ source: "download", version }))).toContain(`Node.js ${expected}`);
    });

    it.each([
        "26.6.99",
        "25.99.99",
        "26.7",
        "26.07.0",
        "9007199254740992.0.0",
        "26.7.0-rc.1",
        "26.7.0+build.1",
    ])("rejects unsupported download version %s", (version) => {
        expect(() => deploy(JSON.stringify({ source: "download", version }))).toThrow();
    });

    it.each([
        '{ source: "host", version: "99.0.0" }',
        `{ source: "host", version: "${process.versions.node}-rc.1" }`,
    ])("rejects an unsupported or mismatched host version", (node) => {
        expect(() => deploy(node)).toThrow();
    });

    it("rejects a mismatched configured runtime version", () => {
        const node = JSON.stringify({ source: "path", path: PATH_NODE, version: "99.0.0" });

        expect(() => deploy(node, 0o755)).toThrow();
    });

    it("rejects a missing configured runtime", () => {
        expect(() => deploy(JSON.stringify({ source: "path", path: PATH_NODE }))).toThrow();
    });

    it("rejects a runtime that cannot execute", () => {
        expect(() => deploy(JSON.stringify({ source: "path", path: PATH_NODE }), 0o644)).toThrow();
    });
});

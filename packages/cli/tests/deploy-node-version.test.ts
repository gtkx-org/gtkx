import { chmodSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { createCliProject, runCliOrThrow } from "./cli-project.js";

const APPLICATION_ID = "com.gtkx.deploynodeversion";
const BINARY_NAME = "gtkx-node-version-probe";
const PATH_NODE_VERSION = "88.9.1";
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

const deploy = (node: string, runtimeSource?: string): string => {
    using project = createCliProject({
        prefix: "gtkx-deploy-node-version-",
        config: deployConfig(node),
        files: {
            ...projectFiles(),
            ...(runtimeSource !== undefined && { [PATH_NODE]: runtimeSource }),
        },
        hasStore: true,
    });

    if (runtimeSource !== undefined) {
        chmodSync(join(project.root, PATH_NODE), 0o755);
    }

    runCliOrThrow(project, ["deploy", "--print-manifests", "--target", "deb"]);

    return readFileSync(
        join(project.root, "build", "overlay", "deb", "share", "doc", BINARY_NAME, "copyright"),
        "utf8",
    );
};

describe("gtkx deploy Node.js runtime versions", () => {
    it("reports the actual host runtime version", () => {
        expect(deploy('{ source: "host" }')).toContain(`Node.js ${process.versions.node}`);
    });

    it("probes a configured runtime path and verifies an explicit expected version", () => {
        const node = `{ source: "path", path: ${JSON.stringify(PATH_NODE)}, version: "${PATH_NODE_VERSION}" }`;
        const runtime = `#!/bin/sh\n[ "$1" = "--version" ] || exit 1\nprintf 'v${PATH_NODE_VERSION}\\n'\n`;

        expect(deploy(node, runtime)).toContain(`Node.js ${PATH_NODE_VERSION}`);
    });

    it.each([
        '{ source: "download", version: "24.0.0" }',
        '{ source: "host", version: "99.0.0" }',
    ])("rejects an unsupported or mismatched runtime version", (node) => {
        expect(() => deploy(node)).toThrow();
    });
});

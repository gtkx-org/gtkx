import { MINIMUM_NODE_VERSION } from "@gtkx/config/internal";
import { info, tryResolveExecutable } from "@gtkx/utils";
import { execFileSync } from "node:child_process";
import { chmodSync, copyFileSync, mkdirSync, statSync } from "node:fs";
import { join, resolve } from "node:path";
import type { DeploySettings, NodeRuntime } from "../types.js";
import { runCliTool } from "../../internal/run-cli-tool.js";
import { downloadNode } from "./download.js";
import { readElfInfo } from "./elf.js";
import { assertPortableNode } from "./guard.js";
import { licenseBesideNode } from "./license.js";

type StagedRuntime = {
    path: string;
    licenseFile: string | null;
};

type NodeSource = "download" | "host" | "path";

const BYTES_PER_MIB = 1024 * 1024;
const EXECUTABLE_MODE = 0o755;
const NODE_FILENAME = "node";
const NODE_VERSION_PATTERN = /^v?(\d+)\.(\d+)\.(\d+)$/;
const VERSION_PROBE_TIMEOUT_MS = 10_000;
const VERSION_PROBE_MAX_BUFFER = 1024;

const nodeSourceFor = (settings: DeploySettings): NodeSource => settings.deploy.node?.source ?? "download";

const parseNodeVersion = (value: string, subject: string): { parts: number[]; version: string } => {
    const match = NODE_VERSION_PATTERN.exec(value.trim());

    if (match === null) {
        throw new Error(`Cannot determine the Node.js version for ${subject}: expected a version such as 26.7.0`);
    }

    const parts = match.slice(1).map(Number);

    return { parts, version: parts.map(String).join(".") };
};

const compareVersions = (left: number[], right: number[]): number => {
    for (let index = 0; index < Math.max(left.length, right.length); index += 1) {
        const difference = (left[index] ?? 0) - (right[index] ?? 0);

        if (difference !== 0) {
            return difference;
        }
    }

    return 0;
};

const supportedNodeVersion = (value: string, subject: string): string => {
    const parsed = parseNodeVersion(value, subject);
    const minimum = parseNodeVersion(MINIMUM_NODE_VERSION, "GTKX");

    if (compareVersions(parsed.parts, minimum.parts) < 0) {
        throw new Error(
            `Cannot bundle Node.js ${parsed.version} for ${subject}: GTKX requires ${MINIMUM_NODE_VERSION} or newer`,
        );
    }

    return parsed.version;
};

const probeNodeVersion = (path: string): string => {
    try {
        const output = execFileSync(path, ["--version"], {
            encoding: "utf8",
            env: { ...process.env, NODE_OPTIONS: "" },
            maxBuffer: VERSION_PROBE_MAX_BUFFER,
            timeout: VERSION_PROBE_TIMEOUT_MS,
        });

        return supportedNodeVersion(output, path);
    } catch (error) {
        if (error instanceof Error && error.message.startsWith("Cannot bundle Node.js")) {
            throw error;
        }

        throw new Error(`Cannot determine the Node.js version from ${path}`, { cause: error });
    }
};

const assertExpectedVersion = (configured: string | undefined, actual: string, source: NodeSource): string => {
    if (configured === undefined) {
        return actual;
    }

    const expected = parseNodeVersion(configured, `deploy.node.source: "${source}"`).version;

    if (expected !== actual) {
        throw new Error(
            `The Node.js runtime from deploy.node.source "${source}" is ${actual}, not the configured ${expected}`,
        );
    }

    return actual;
};

const sourcePathFor = (settings: DeploySettings): string => {
    const node = settings.deploy.node ?? {};
    const source = nodeSourceFor(settings);

    if (source === "host") {
        return process.execPath;
    }

    if (node.path === undefined) {
        throw new Error('Cannot resolve the Node.js runtime: `deploy.node.source: "path"` needs `deploy.node.path`');
    }

    return resolve(settings.paths.root, node.path);
};

const resolveNodeVersion = (settings: DeploySettings): string => {
    const node = settings.deploy.node ?? {};
    const source = nodeSourceFor(settings);

    if (source === "download") {
        return supportedNodeVersion(node.version ?? MINIMUM_NODE_VERSION, 'deploy.node.source: "download"');
    }

    const actual = source === "host"
        ? supportedNodeVersion(process.versions.node, 'deploy.node.source: "host"')
        : probeNodeVersion(sourcePathFor(settings));

    return assertExpectedVersion(node.version, actual, source);
};

const didStripBinary = (path: string): boolean => {
    if (tryResolveExecutable("strip") === undefined) {
        return false;
    }

    runCliTool({ tool: "strip", args: ["--strip-unneeded", path], target: "the bundled Node.js" });

    return true;
};

const megabytes = (path: string): string => (statSync(path).size / BYTES_PER_MIB).toFixed(1);

const stageNode = (settings: DeploySettings, sourcePath: string): string => {
    mkdirSync(settings.paths.runtime, { recursive: true });
    const staged = join(settings.paths.runtime, NODE_FILENAME);
    copyFileSync(sourcePath, staged);
    chmodSync(staged, EXECUTABLE_MODE);

    return staged;
};

const stageDownloadedNode = async (settings: DeploySettings, version: string): Promise<StagedRuntime> => {
    const downloaded = await downloadNode(version, settings.arch.node, settings.paths.runtime);
    chmodSync(downloaded.path, EXECUTABLE_MODE);

    return downloaded;
};

const stageFromSource = async (
    settings: DeploySettings,
    version: string,
    source: NodeSource,
): Promise<StagedRuntime> => {
    if (source === "download") {
        return stageDownloadedNode(settings, version);
    }

    const sourcePath = sourcePathFor(settings);
    assertPortableNode(readElfInfo(sourcePath), source);

    return { path: stageNode(settings, sourcePath), licenseFile: licenseBesideNode(sourcePath) };
};

const resolveNodeRuntime = async (settings: DeploySettings): Promise<NodeRuntime> => {
    const node = settings.deploy.node ?? {};
    const source = nodeSourceFor(settings);
    const version = resolveNodeVersion(settings);
    const staged = await stageFromSource(settings, version, source);
    const isStripped = node.shouldStrip === false ? false : didStripBinary(staged.path);
    const elf = readElfInfo(staged.path);
    info(`Bundled Node.js v${version} (${megabytes(staged.path)} MiB, glibc >= ${elf.glibcMinimum ?? "unknown"})`);

    return { ...staged, version, glibcMinimum: elf.glibcMinimum, isStripped };
};

export { resolveNodeRuntime, resolveNodeVersion, sourcePathFor };

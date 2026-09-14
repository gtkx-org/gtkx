import { MINIMUM_NODE_VERSION } from "@gtkx/config/internal";
import { info, tryResolveExecutable, warn } from "@gtkx/utils";
import { execFileSync } from "node:child_process";
import { chmodSync, copyFileSync, existsSync, mkdirSync, statSync } from "node:fs";
import { join, resolve } from "node:path";
import { lt, parse } from "semver";
import type { DeployConfig, DeploySettings, NodeRuntime } from "../types.js";
import { runCliTool } from "../../internal/run-cli-tool.js";
import { elfMachineFor, hostArchName } from "../settings/arch.js";
import { downloadNode } from "./download.js";
import { type ElfInfo, readElfInfo, readOptionalElfInfo } from "./elf.js";
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
const VERSION_PROBE_TIMEOUT_MS = 10_000;
const VERSION_PROBE_MAX_BUFFER = 1024;

const nodeSourceFor = (settings: DeploySettings): NodeSource => settings.deploy.node?.source ?? "download";

const parseNodeVersion = (value: string, subject: string): string => {
    const parsed = parse(value.trim());

    if (parsed === null || parsed.prerelease.length > 0 || parsed.build.length > 0) {
        throw new Error(`Cannot determine the Node.js version for ${subject}: expected a release such as 26.7.0`);
    }

    return parsed.version;
};

const supportedNodeVersion = (value: string, subject: string): string => {
    const version = parseNodeVersion(value, subject);

    if (lt(version, MINIMUM_NODE_VERSION)) {
        throw new Error(
            `Cannot bundle Node.js ${version} for ${subject}: GTKX requires ${MINIMUM_NODE_VERSION} or newer`,
        );
    }

    return version;
};

const probeNodeVersion = (path: string): string => {
    let output: string;

    try {
        output = execFileSync(path, ["--version"], {
            encoding: "utf8",
            env: { ...process.env, NODE_OPTIONS: "" },
            maxBuffer: VERSION_PROBE_MAX_BUFFER,
            timeout: VERSION_PROBE_TIMEOUT_MS,
        });
    } catch (error) {
        throw new Error(`Cannot determine the Node.js version from ${path}`, { cause: error });
    }

    return supportedNodeVersion(output, path);
};

const assertExpectedVersion = (configured: string | undefined, actual: string, source: NodeSource): string => {
    if (configured === undefined) {
        return actual;
    }

    const expected = parseNodeVersion(configured, `deploy.node.source: "${source}"`);

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

const assertPortableRuntimeSource = (settings: DeploySettings): void => {
    const source = nodeSourceFor(settings);

    if (source === "download") {
        return;
    }

    const sourcePath = sourcePathFor(settings);
    const elf = existsSync(sourcePath) ? readOptionalElfInfo(sourcePath) : null;

    if (elf !== null) {
        assertPortableNode(elf, source);
    }
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

    return { path: stageNode(settings, sourcePath), licenseFile: licenseBesideNode(sourcePath) };
};

type DeployNodeConfig = NonNullable<DeployConfig["node"]>;

const shouldStripRuntime = (settings: DeploySettings, node: DeployNodeConfig, elf: ElfInfo): boolean => {
    if (node.shouldStrip === false) {
        return false;
    }

    if (elf.machine === elfMachineFor(hostArchName())) {
        return true;
    }

    warn(
        `Skipping \`strip\` on the bundled Node.js: it was built for ${settings.arch.node} and \`strip\` reads ` +
        `only ${hostArchName()}. The ${settings.arch.node} packages carry an unstripped runtime.`,
    );

    return false;
};

const resolveNodeRuntime = async (settings: DeploySettings): Promise<NodeRuntime> => {
    const node = settings.deploy.node ?? {};
    const source = nodeSourceFor(settings);
    const version = resolveNodeVersion(settings);
    const staged = await stageFromSource(settings, version, source);
    const elf = readElfInfo(staged.path);
    assertPortableNode(elf, source);
    const isStripped = shouldStripRuntime(settings, node, elf) && didStripBinary(staged.path);
    const glibcMinimum = elf.glibcMinimum ?? "unknown";
    info(`Bundled Node.js v${version} (${megabytes(staged.path)} MiB, runtime glibc >= ${glibcMinimum})`);

    return { ...staged, version, glibcMinimum: elf.glibcMinimum, isStripped };
};

export { assertPortableRuntimeSource, resolveNodeRuntime, resolveNodeVersion, sourcePathFor };

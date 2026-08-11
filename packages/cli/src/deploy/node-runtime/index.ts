import { info, tryResolveExecutable } from "@gtkx/utils";
import { chmodSync, copyFileSync, mkdirSync, statSync } from "node:fs";
import { join, resolve } from "node:path";
import type { DeploySettings, NodeRuntime } from "../types.js";
import { runCliTool } from "../../internal/run-cli-tool.js";
import { downloadNode } from "./download.js";
import { readElfInfo } from "./elf.js";
import { assertPortableNode } from "./guard.js";

const BYTES_PER_MIB = 1024 * 1024;
const EXECUTABLE_MODE = 0o755;
const NODE_FILENAME = "node";

const sourcePathFor = (settings: DeploySettings): string => {
    const node = settings.deploy.node ?? {};
    const source = node.source ?? "download";

    if (source === "host") {
        return process.execPath;
    }

    if (node.path === undefined) {
        throw new Error('Cannot resolve the Node.js runtime: `deploy.node.source: "path"` needs `deploy.node.path`');
    }

    return resolve(settings.paths.root, node.path);
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

const stageDownloadedNode = async (settings: DeploySettings, version: string): Promise<string> => {
    const staged = await downloadNode(version, settings.arch.node, settings.paths.runtime);
    chmodSync(staged, EXECUTABLE_MODE);

    return staged;
};

const stageFromSource = async (settings: DeploySettings, version: string, source: string): Promise<string> => {
    if (source === "download") {
        return stageDownloadedNode(settings, version);
    }

    const sourcePath = sourcePathFor(settings);
    assertPortableNode(readElfInfo(sourcePath), source);

    return stageNode(settings, sourcePath);
};

const resolveNodeRuntime = async (settings: DeploySettings): Promise<NodeRuntime> => {
    const node = settings.deploy.node ?? {};
    const source = node.source ?? "download";
    const version = node.version ?? process.versions.node;
    const staged = await stageFromSource(settings, version, source);
    const isStripped = node.shouldStrip === false ? false : didStripBinary(staged);
    const elf = readElfInfo(staged);
    info(`Bundled Node.js v${version} (${megabytes(staged)} MiB, glibc >= ${elf.glibcFloor ?? "unknown"})`);

    return { path: staged, version, glibcFloor: elf.glibcFloor, isStripped };
};

export { resolveNodeRuntime };

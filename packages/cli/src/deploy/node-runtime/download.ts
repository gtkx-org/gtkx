import { existsSync } from "node:fs";
import { join } from "node:path";
import { runCliTool } from "../../internal/run-cli-tool.js";
import { cacheDir, downloadFile, fetchText } from "../download.js";

const DIST_BASE_URL = "https://nodejs.org/dist";
const STRIP_COMPONENTS = "2";

const releaseName = (version: string, arch: string): string => `node-v${version}-linux-${arch}`;

const expectedDigest = async (version: string, assetName: string): Promise<string> => {
    const checksums = await fetchText(`${DIST_BASE_URL}/v${version}/SHASUMS256.txt`);
    const line = checksums.split("\n").find((entry) => entry.trim().endsWith(` ${assetName}`));
    const digest = line?.trim().split(/\s+/, 1)[0];

    if (digest === undefined) {
        throw new Error(`Node.js ${version} publishes no checksum for ${assetName}`);
    }

    return digest;
};

const extractNode = (archive: string, dir: string, version: string, arch: string): void => {
    runCliTool({
        tool: "tar",
        args: ["-xJf", archive, "-C", dir, "--strip-components", STRIP_COMPONENTS,
            `${releaseName(version, arch)}/bin/node`],
        target: `Node.js ${version}`,
    });
};

const fetchNode = async (dir: string, version: string, arch: string): Promise<void> => {
    const assetName = `${releaseName(version, arch)}.tar.xz`;

    const archive = await downloadFile({
        url: `${DIST_BASE_URL}/v${version}/${assetName}`,
        dest: join(dir, assetName),
        label: `Node.js ${version} for linux-${arch}`,
        sha256: await expectedDigest(version, assetName),
    });

    extractNode(archive, dir, version, arch);
};

const downloadNode = async (version: string, arch: string): Promise<string> => {
    const dir = cacheDir(["node", `${version}-linux-${arch}`]);
    const binary = join(dir, "node");

    if (!existsSync(binary)) {
        await fetchNode(dir, version, arch);
    }

    return binary;
};

export { downloadNode };

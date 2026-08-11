import { mkdirSync } from "node:fs";
import { join } from "node:path";
import { runCliTool } from "../../internal/run-cli-tool.js";
import { cachedFetchText, cacheDir, digestFromChecksums, downloadFile } from "../download.js";

const DIST_BASE_URL = "https://nodejs.org/dist";
const STRIP_COMPONENTS = "2";
const CHECKSUMS_FILE = "SHASUMS256.txt";

const releaseName = (version: string, arch: string): string => `node-v${version}-linux-${arch}`;

const expectedDigest = async (version: string, assetName: string, dir: string): Promise<string> => {
    const checksums = await cachedFetchText(`${DIST_BASE_URL}/v${version}/SHASUMS256.txt`, join(dir, CHECKSUMS_FILE));

    return digestFromChecksums(checksums, assetName, `Node.js ${version}`);
};

const extractNode = (archive: string, dir: string, version: string, arch: string): void => {
    runCliTool({
        tool: "tar",
        args: ["-xJf", archive, "-C", dir, "--strip-components", STRIP_COMPONENTS,
            `${releaseName(version, arch)}/bin/node`],
        target: `Node.js ${version}`,
    });
};

const downloadNode = async (version: string, arch: string, destDir: string): Promise<string> => {
    const assetName = `${releaseName(version, arch)}.tar.xz`;
    const dir = cacheDir(["node", `${version}-linux-${arch}`]);

    const archive = await downloadFile({
        url: `${DIST_BASE_URL}/v${version}/${assetName}`,
        dest: join(dir, assetName),
        label: `Node.js ${version} for linux-${arch}`,
        sha256: await expectedDigest(version, assetName, dir),
    });

    mkdirSync(destDir, { recursive: true });
    extractNode(archive, destDir, version, arch);

    return join(destDir, "node");
};

export { downloadNode };

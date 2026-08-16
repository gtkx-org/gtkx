import { mkdirSync } from "node:fs";
import { join } from "node:path";
import type { DigestRequest } from "../download.js";
import { runCliTool } from "../../internal/run-cli-tool.js";
import { cachedDigest, cacheDir, downloadFile, publishedDigest } from "../download.js";
import { LICENSE_FILENAME } from "./license.js";

type DownloadedNode = {
    path: string;
    licenseFile: string;
};

const DIST_BASE_URL = "https://nodejs.org/dist";
const STRIP_COMPONENTS = "1";
const CHECKSUMS_FILE = "SHASUMS256.txt";
const NODE_PATH = "bin/node";

const releaseName = (version: string, arch: string): string => `node-v${version}-linux-${arch}`;

const digestRequest = (version: string, assetName: string, dir: string): DigestRequest => ({
    url: `${DIST_BASE_URL}/v${version}/${CHECKSUMS_FILE}`,
    dest: join(dir, `${assetName}.sha256`),
    assetName,
    subject: `Node.js ${version}`,
});

const extractNode = (archive: string, dir: string, version: string, arch: string): void => {
    const release = releaseName(version, arch);

    runCliTool({
        tool: "tar",
        args: ["-xJf", archive, "-C", dir, "--strip-components", STRIP_COMPONENTS,
            `${release}/${NODE_PATH}`, `${release}/${LICENSE_FILENAME}`],
        target: `Node.js ${version}`,
    });
};

const downloadNode = async (version: string, arch: string, destDir: string): Promise<DownloadedNode> => {
    const assetName = `${releaseName(version, arch)}.tar.xz`;
    const dir = cacheDir(["node", `${version}-linux-${arch}`]);
    const request = digestRequest(version, assetName, dir);

    const archive = await downloadFile({
        url: `${DIST_BASE_URL}/v${version}/${assetName}`,
        dest: join(dir, assetName),
        label: `Node.js ${version} for linux-${arch}`,
        sha256: await cachedDigest(request),
        freshSha256: () => publishedDigest(request),
    });

    mkdirSync(destDir, { recursive: true });
    extractNode(archive, destDir, version, arch);

    return { path: join(destDir, NODE_PATH), licenseFile: join(destDir, LICENSE_FILENAME) };
};

export { downloadNode };

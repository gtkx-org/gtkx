import { mkdirSync } from "node:fs";
import { join } from "node:path";
import type { DigestRequest } from "../download.js";
import { runCliTool } from "../../internal/run-cli-tool.js";
import { cachedDigest, cacheDir, downloadFile, publishedDigest } from "../download.js";

const DIST_BASE_URL = "https://nodejs.org/dist";
const STRIP_COMPONENTS = "2";
const CHECKSUMS_FILE = "SHASUMS256.txt";

const releaseName = (version: string, arch: string): string => `node-v${version}-linux-${arch}`;

const digestRequest = (version: string, assetName: string, dir: string): DigestRequest => ({
    url: `${DIST_BASE_URL}/v${version}/${CHECKSUMS_FILE}`,
    dest: join(dir, `${assetName}.sha256`),
    assetName,
    subject: `Node.js ${version}`,
});

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

    return join(destDir, "node");
};

export { downloadNode };

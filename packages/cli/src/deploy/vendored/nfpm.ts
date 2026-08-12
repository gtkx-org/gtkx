import { mkdtempSync, renameSync, rmSync } from "node:fs";
import { join } from "node:path";
import type { DigestRequest } from "../download.js";
import { runCliTool } from "../../internal/run-cli-tool.js";
import { cachedDigest, cacheDir, downloadFile, publishedDigest } from "../download.js";

const NFPM_VERSION = "2.47.0";
const NFPM_BASE_URL = `https://github.com/goreleaser/nfpm/releases/download/v${NFPM_VERSION}`;
const CHECKSUMS_FILE = "checksums.txt";

const NFPM_ASSET_ARCH: Record<string, string> = {
    arm64: "arm64",
    x64: "x86_64",
};

const assetNameFor = (arch: string): string => {
    const assetArch = NFPM_ASSET_ARCH[arch];

    if (assetArch === undefined) {
        throw new Error(`nfpm has no Linux build for ${arch}`);
    }

    return `nfpm_${NFPM_VERSION}_Linux_${assetArch}.tar.gz`;
};

const digestRequest = (assetName: string, dir: string): DigestRequest => ({
    url: `${NFPM_BASE_URL}/${CHECKSUMS_FILE}`,
    dest: join(dir, `${assetName}.sha256`),
    assetName,
    subject: `nfpm ${NFPM_VERSION}`,
});

const extractNfpm = (archive: string, binary: string): void => {
    const dir = mkdtempSync(`${binary}-`);

    try {
        runCliTool({ tool: "tar", args: ["-xzf", archive, "-C", dir, "nfpm"], target: assetNameFor(process.arch) });
        renameSync(join(dir, "nfpm"), binary);
    } finally {
        rmSync(dir, { recursive: true, force: true, maxRetries: 5 });
    }
};

const downloadNfpm = async (dir: string, binary: string): Promise<string> => {
    const assetName = assetNameFor(process.arch);
    const request = digestRequest(assetName, dir);

    const archive = await downloadFile({
        url: `${NFPM_BASE_URL}/${assetName}`,
        dest: join(dir, assetName),
        label: `nfpm ${NFPM_VERSION}`,
        sha256: await cachedDigest(request),
        freshSha256: () => publishedDigest(request),
    });

    extractNfpm(archive, binary);

    return binary;
};

const resolveNfpm = async (): Promise<string> => {
    const override = process.env.GTKX_NFPM;

    if (override !== undefined && override.length > 0) {
        return override;
    }

    const dir = cacheDir(["nfpm", NFPM_VERSION]);

    return downloadNfpm(dir, join(dir, "nfpm"));
};

export { resolveNfpm };

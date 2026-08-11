import { join } from "node:path";
import { runCliTool } from "../../internal/run-cli-tool.js";
import { cachedFetchText, cacheDir, digestFromChecksums, downloadFile } from "../download.js";

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

const expectedDigest = async (assetName: string, dir: string): Promise<string> => {
    const checksums = await cachedFetchText(`${NFPM_BASE_URL}/${CHECKSUMS_FILE}`, join(dir, CHECKSUMS_FILE));

    return digestFromChecksums(checksums, assetName, `nfpm ${NFPM_VERSION}`);
};

const extractNfpm = (archive: string, dir: string): void => {
    runCliTool({ tool: "tar", args: ["-xzf", archive, "-C", dir, "nfpm"], target: assetNameFor(process.arch) });
};

const downloadNfpm = async (dir: string, binary: string): Promise<string> => {
    const assetName = assetNameFor(process.arch);

    const archive = await downloadFile({
        url: `${NFPM_BASE_URL}/${assetName}`,
        dest: join(dir, assetName),
        label: `nfpm ${NFPM_VERSION}`,
        sha256: await expectedDigest(assetName, dir),
    });

    extractNfpm(archive, dir);

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

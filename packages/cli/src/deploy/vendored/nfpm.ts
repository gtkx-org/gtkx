import { mkdtempSync, renameSync, rmSync } from "node:fs";
import { join, resolve } from "node:path";
import { runCliTool } from "../../internal/run-cli-tool.js";
import { cacheDir, downloadFile } from "../download.js";

const NFPM_VERSION = "2.49.0";
const NFPM_BASE_URL = `https://github.com/goreleaser/nfpm/releases/download/v${NFPM_VERSION}`;

const NFPM_ASSET_ARCH: Record<string, string> = {
    arm64: "arm64",
    x64: "x86_64",
};

const NFPM_DIGESTS: Record<string, string> = {
    arm64: "d4eee71839e92c68cbd3b101640bad32d2856fc551acae0635be9118e48c9d9c",
    x86_64: "2afaa5ffb5e3493402e31e7c67a5a1fb42133e3f66fc315ca0051934125561c7",
};

const assetArchFor = (arch: string): string => {
    const assetArch = NFPM_ASSET_ARCH[arch];

    if (assetArch === undefined) {
        throw new Error(`nfpm has no Linux build for ${arch}`);
    }

    return assetArch;
};

const assetNameFor = (arch: string): string => `nfpm_${NFPM_VERSION}_Linux_${assetArchFor(arch)}.tar.gz`;

const digestFor = (arch: string): string => {
    const digest = NFPM_DIGESTS[assetArchFor(arch)];

    if (digest === undefined) {
        throw new Error(`nfpm ${NFPM_VERSION} has no pinned digest for ${arch}`);
    }

    return digest;
};

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

    const archive = await downloadFile({
        url: `${NFPM_BASE_URL}/${assetName}`,
        dest: join(dir, assetName),
        label: `nfpm ${NFPM_VERSION}`,
        digest: digestFor(process.arch),
    });

    extractNfpm(archive, binary);

    return binary;
};

const configuredNfpm = (root: string, override: string): string =>
    override.includes("/") ? resolve(root, override) : override;

const resolveNfpm = async (root: string, override?: string): Promise<string> => {
    if (override !== undefined) {
        return configuredNfpm(root, override);
    }

    const dir = cacheDir(["nfpm", NFPM_VERSION]);

    return downloadNfpm(dir, join(dir, "nfpm"));
};

export { configuredNfpm, resolveNfpm };

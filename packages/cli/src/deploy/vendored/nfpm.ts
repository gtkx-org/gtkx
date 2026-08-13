import { mkdtempSync, renameSync, rmSync } from "node:fs";
import { join } from "node:path";
import { runCliTool } from "../../internal/run-cli-tool.js";
import { cacheDir, downloadFile } from "../download.js";

const NFPM_VERSION = "2.47.0";
const NFPM_BASE_URL = `https://github.com/goreleaser/nfpm/releases/download/v${NFPM_VERSION}`;

const NFPM_ASSET_ARCH: Record<string, string> = {
    arm64: "arm64",
    x64: "x86_64",
};

const NFPM_DIGESTS: Record<string, string> = {
    arm64: "1c0f5f2999b9a974bfb04fdb0cc3306096de530ac5dbb25d739cc5f5219c919c",
    x86_64: "0660ca602b2d2d2ae4781a06c692b3eeb9d437ffea05b831d76e41f4a3188783",
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
        sha256: digestFor(process.arch),
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

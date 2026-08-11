import { info, warn } from "@gtkx/utils";
import { createHash } from "node:crypto";
import { chmodSync, existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

type DownloadRequest = {
    url: string;
    dest: string;
    label: string;
    sha256: string;
    mode?: number | undefined;
};

const CACHE_NAMESPACE = "gtkx";

const cacheRoot = (): string => {
    const base = process.env.XDG_CACHE_HOME;

    return join(base !== undefined && base.length > 0 ? base : join(homedir(), ".cache"), CACHE_NAMESPACE);
};

const cacheDir = (segments: string[]): string => {
    const dir = join(cacheRoot(), ...segments);
    mkdirSync(dir, { recursive: true });

    return dir;
};

const getDigest = (contents: Buffer): string => createHash("sha256").update(contents).digest("hex");

const assertDigest = (url: string, contents: Buffer, expected: string): void => {
    const actual = getDigest(contents);

    if (actual !== expected) {
        throw new Error(`Checksum mismatch for ${url}\n  expected ${expected}\n  received ${actual}`);
    }
};

const fetchBytes = async (url: string): Promise<Buffer> => {
    const response = await fetch(url);

    if (!response.ok) {
        throw new Error(`Cannot download ${url}: HTTP ${String(response.status)} ${response.statusText}`);
    }

    return Buffer.from(await response.arrayBuffer());
};

const fetchText = async (url: string): Promise<string> => {
    const bytes = await fetchBytes(url);

    return bytes.toString("utf8");
};

const cachedFetchText = async (url: string, dest: string): Promise<string> => {
    if (existsSync(dest)) {
        return readFileSync(dest, "utf8");
    }

    const contents = await fetchText(url);
    writeFileSync(dest, contents);

    return contents;
};

const isCacheUsable = (dest: string, sha256: string): boolean => {
    if (!existsSync(dest)) {
        return false;
    }

    if (getDigest(readFileSync(dest)) === sha256) {
        return true;
    }

    warn(`Discarding the cached ${dest}: its checksum no longer matches`);

    return false;
};

const downloadFile = async ({ url, dest, label, sha256, mode }: DownloadRequest): Promise<string> => {
    if (isCacheUsable(dest, sha256)) {
        return dest;
    }

    info(`Downloading ${label}`);
    const contents = await fetchBytes(url);
    assertDigest(url, contents, sha256);
    const staging = `${dest}.partial`;
    writeFileSync(staging, contents);

    if (mode !== undefined) {
        chmodSync(staging, mode);
    }

    renameSync(staging, dest);

    return dest;
};

const digestFromChecksums = (checksums: string, assetName: string, subject: string): string => {
    const line = checksums.split("\n").find((entry) => entry.trim().endsWith(` ${assetName}`));
    const digest = line?.trim().split(/\s+/, 1)[0];

    if (digest === undefined) {
        throw new Error(`${subject} publishes no checksum for ${assetName}`);
    }

    return digest;
};

export { cacheDir, cachedFetchText, digestFromChecksums, downloadFile };

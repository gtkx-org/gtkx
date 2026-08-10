import { info } from "@gtkx/utils";
import { createHash } from "node:crypto";
import { chmodSync, existsSync, mkdirSync, renameSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

type DownloadRequest = {
    url: string;
    dest: string;
    label: string;
    sha256?: string | undefined;
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

const assertDigest = (url: string, contents: Buffer, expected: string | undefined): void => {
    if (expected === undefined) {
        return;
    }

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

const downloadFile = async ({ url, dest, label, sha256, mode }: DownloadRequest): Promise<string> => {
    if (existsSync(dest)) {
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

export { cacheDir, downloadFile, fetchText };

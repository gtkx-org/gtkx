import { info, warn } from "@gtkx/utils";
import { createHash } from "node:crypto";
import { chmodSync, existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

type DigestRequest = {
    url: string;
    dest: string;
    assetName: string;
    subject: string;
};

type DownloadRequest = {
    url: string;
    dest: string;
    label: string;
    sha256: string;
    freshSha256?: (() => Promise<string>) | undefined;
    mode?: number | undefined;
};

const CACHE_NAMESPACE = "gtkx";
const DIGEST_PATTERN = /^[\da-f]{64}$/;

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

const readCachedDigest = (dest: string): string | undefined => {
    try {
        const cached = readFileSync(dest, "utf8").trim();

        return DIGEST_PATTERN.test(cached) ? cached : undefined;
    } catch {
        return undefined;
    }
};

const writeAtomically = (dest: string, contents: string): void => {
    const staging = `${dest}.partial`;
    writeFileSync(staging, contents);
    renameSync(staging, dest);
};

const publishedDigest = async (request: DigestRequest): Promise<string> => {
    const checksums = await fetchText(request.url);
    const digest = digestFromChecksums(checksums, request.assetName, request.subject);

    if (!DIGEST_PATTERN.test(digest)) {
        throw new Error(`${request.subject} published a malformed checksum for ${request.assetName}: "${digest}"`);
    }

    writeAtomically(request.dest, digest);

    return digest;
};

const cachedDigest = async (request: DigestRequest): Promise<string> => {
    const cached = readCachedDigest(request.dest);

    return cached ?? publishedDigest(request);
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

const downloadFile = async (request: DownloadRequest): Promise<string> => {
    const { url, dest, label, sha256, mode } = request;

    if (isCacheUsable(dest, sha256)) {
        return dest;
    }

    info(`Downloading ${label}`);
    const expected = request.freshSha256 === undefined ? sha256 : await request.freshSha256();
    const contents = await fetchBytes(url);
    assertDigest(url, contents, expected);
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

export { cacheDir, cachedDigest, type DigestRequest, downloadFile, publishedDigest };

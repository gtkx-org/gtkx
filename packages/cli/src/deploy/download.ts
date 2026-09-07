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

type DigestAlgorithm = "sha256" | "sha512";

type DownloadRequest = {
    url: string;
    dest: string;
    label: string;
    digest: string;
    algorithm?: DigestAlgorithm | undefined;
    freshDigest?: (() => Promise<string>) | undefined;
    mode?: number | undefined;
};

const CACHE_NAMESPACE = "gtkx";
const DIGEST_PATTERN: Record<DigestAlgorithm, RegExp> = {
    sha256: /^[\da-f]{64}$/,
    sha512: /^[\da-f]{128}$/,
};

const cacheRoot = (): string => {
    const base = process.env.XDG_CACHE_HOME;

    return join(base !== undefined && base.length > 0 ? base : join(homedir(), ".cache"), CACHE_NAMESPACE);
};

const cacheDir = (segments: string[]): string => {
    const dir = join(cacheRoot(), ...segments);
    mkdirSync(dir, { recursive: true });

    return dir;
};

const getDigest = (contents: Buffer, algorithm: DigestAlgorithm): string =>
    createHash(algorithm).update(contents).digest("hex");

const assertDigest = (url: string, contents: Buffer, expected: string, algorithm: DigestAlgorithm): void => {
    const actual = getDigest(contents, algorithm);

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

const readCachedDigest = (dest: string, algorithm: DigestAlgorithm): string | undefined => {
    try {
        const cached = readFileSync(dest, "utf8").trim();

        return DIGEST_PATTERN[algorithm].test(cached) ? cached : undefined;
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

    if (!DIGEST_PATTERN.sha256.test(digest)) {
        throw new Error(`${request.subject} published a malformed checksum for ${request.assetName}: "${digest}"`);
    }

    writeAtomically(request.dest, digest);

    return digest;
};

const cachedDigest = async (request: DigestRequest): Promise<string> => {
    const cached = readCachedDigest(request.dest, "sha256");

    return cached ?? publishedDigest(request);
};

const isCacheUsable = (dest: string, digest: string, algorithm: DigestAlgorithm): boolean => {
    if (!existsSync(dest)) {
        return false;
    }

    if (getDigest(readFileSync(dest), algorithm) === digest) {
        return true;
    }

    warn(`Discarding the cached ${dest}: its checksum no longer matches`);

    return false;
};

const downloadFile = async (request: DownloadRequest): Promise<string> => {
    const { url, dest, label, digest, mode } = request;
    const algorithm = request.algorithm ?? "sha256";

    if (isCacheUsable(dest, digest, algorithm)) {
        return dest;
    }

    info(`Downloading ${label}`);
    const expected = request.freshDigest === undefined ? digest : await request.freshDigest();
    const contents = await fetchBytes(url);
    assertDigest(url, contents, expected, algorithm);
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

export {
    cacheDir,
    cachedDigest,
    type DigestAlgorithm,
    type DigestRequest,
    downloadFile,
    publishedDigest,
    readCachedDigest,
    writeAtomically,
};

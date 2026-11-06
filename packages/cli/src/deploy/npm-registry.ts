type Tarball = { url: string; digest: string };

type TarballRequest = {
    registry: string;
    name: string;
    version: string;
    remedy: string;
};

const DEFAULT_REGISTRY = "https://registry.npmjs.org";
const REQUEST_TIMEOUT = 30_000;
const SRI_PREFIX = "sha512-";

const hexFromIntegrity = (integrity: unknown, subject: string): string => {
    if (typeof integrity !== "string" || !integrity.startsWith(SRI_PREFIX)) {
        throw new Error(`The npm registry publishes no sha512 integrity for ${subject}`);
    }

    return Buffer.from(integrity.slice(SRI_PREFIX.length), "base64").toString("hex");
};

const fetchVersionDocument = async (url: string, subject: string, remedy: string): Promise<Record<string, unknown>> => {
    const response = await fetch(url, { signal: AbortSignal.timeout(REQUEST_TIMEOUT) });

    if (!response.ok) {
        throw new Error(`Cannot fetch ${subject}: HTTP ${String(response.status)} ${response.statusText}. ${remedy}`);
    }

    const document: unknown = await response.json();

    if (typeof document !== "object" || document === null) {
        throw new Error(`The npm registry returned no metadata for ${subject}`);
    }

    return document as Record<string, unknown>;
};

/**
 * Reads the tarball URL and sha512 digest the registry publishes for one package version.
 */
const publishedTarball = async ({ registry, name, version, remedy }: TarballRequest): Promise<Tarball> => {
    const subject = `${name}@${version}`;
    const document = await fetchVersionDocument(`${registry}/${encodeURIComponent(name)}/${version}`, subject, remedy);
    const dist: unknown = document.dist;

    if (typeof dist !== "object" || dist === null) {
        throw new Error(`The npm registry returned no tarball for ${subject}`);
    }

    const entry = dist as Record<string, unknown>;
    const tarball = entry.tarball;

    if (typeof tarball !== "string" || new URL(tarball).origin !== new URL(registry).origin) {
        throw new Error(`The npm registry returned an unusable tarball URL for ${subject}`);
    }

    return { url: tarball, digest: hexFromIntegrity(entry.integrity, subject) };
};

export { DEFAULT_REGISTRY, publishedTarball, type Tarball };

import { isRecord } from "@gtkx/utils";
import { readFileSync } from "node:fs";
import { join } from "node:path";

type ManifestAuthor = {
    name: string | null;
    email: string | null;
};

type PackageManifest = {
    name: string | null;
    version: string | null;
    description: string | null;
    license: string | null;
    homepage: string | null;
    author: ManifestAuthor;
};

const AUTHOR_PATTERN = /^(?<name>[^<(]*)(?:\([^)]*\)\s*)?(?:<(?<email>[^>]*)>)?/;
const EMPTY_AUTHOR: ManifestAuthor = { name: null, email: null };

const optionalString = (value: unknown): string | null =>
    typeof value === "string" && value.trim().length > 0 ? value.trim() : null;

const parseAuthorString = (author: string): ManifestAuthor => {
    const groups = AUTHOR_PATTERN.exec(author)?.groups;

    return { name: optionalString(groups?.name), email: optionalString(groups?.email) };
};

const parseAuthor = (author: unknown): ManifestAuthor => {
    if (typeof author === "string") {
        return parseAuthorString(author);
    }

    if (!isRecord(author)) {
        return EMPTY_AUTHOR;
    }

    return { name: optionalString(author.name), email: optionalString(author.email) };
};

const readManifestJson = (root: string): Record<string, unknown> => {
    try {
        const parsed: unknown = JSON.parse(readFileSync(join(root, "package.json"), "utf8"));

        return isRecord(parsed) ? parsed : {};
    } catch {
        return {};
    }
};

const readPackageManifest = (root: string): PackageManifest => {
    const manifest = readManifestJson(root);

    return {
        name: optionalString(manifest.name),
        version: optionalString(manifest.version),
        description: optionalString(manifest.description),
        license: optionalString(manifest.license),
        homepage: optionalString(manifest.homepage),
        author: parseAuthor(manifest.author),
    };
};

export { type PackageManifest, readPackageManifest };

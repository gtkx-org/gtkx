import type { Plugin } from "vite";
import { isRecord, sortStringsBy } from "@gtkx/utils";
import { readFileSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import {
    BUILD_MANIFEST_FILENAME,
    BUILD_MANIFEST_FORMAT_VERSION,
    BUILD_MANIFEST_GENERATOR,
    type BuildManifest,
    type BuildManifestCollector,
    type RecordedPackage,
} from "../internal/build-manifest.js";
import { stripQuery } from "./strip-query.js";

type PackageIdentity = {
    name: string;
    version: string | null;
};

type ManifestState = {
    outDir: string;
};

const PACKAGE_MANIFEST_FILENAME = "package.json";
const DEFAULT_OUT_DIR = "dist";
const JSON_INDENT = 4;

const identityIn = (dir: string): PackageIdentity | null => {
    try {
        const parsed: unknown = JSON.parse(readFileSync(join(dir, PACKAGE_MANIFEST_FILENAME), "utf8"));

        if (!isRecord(parsed) || typeof parsed.name !== "string") {
            return null;
        }

        return { name: parsed.name, version: typeof parsed.version === "string" ? parsed.version : null };
    } catch {
        return null;
    }
};

const packageIn = (dir: string): RecordedPackage | null => {
    const identity = identityIn(dir);

    if (identity !== null) {
        return { ...identity, dir };
    }

    const parent = dirname(dir);

    return parent === dir ? null : packageIn(parent);
};

const packageForModule = (id: string): RecordedPackage | null => {
    const path = stripQuery(id);

    return path.startsWith("/") ? packageIn(dirname(path)) : null;
};

const packageKey = (entry: RecordedPackage): string => `${entry.name}@${entry.version ?? ""}`;

const relativeTo = (outDir: string, entry: RecordedPackage): RecordedPackage => ({
    ...entry,
    dir: relative(outDir, entry.dir),
});

const packagesFor = (outDir: string, ids: string[]): RecordedPackage[] => {
    const found = ids.map((id) => packageForModule(id)).filter((entry) => entry !== null);
    const unique: Map<string, RecordedPackage> = new Map(found.map((entry) => [packageKey(entry), entry]));

    return sortStringsBy(unique.values(), packageKey).map((entry) => relativeTo(outDir, entry));
};

const renderManifest = (manifest: BuildManifest): string => `${JSON.stringify(manifest, null, JSON_INDENT)}\n`;

function gtkxBuildManifest(root: string, collector: BuildManifestCollector): Plugin {
    const state: ManifestState = { outDir: join(root, DEFAULT_OUT_DIR) };

    return {
        name: "gtkx:build-manifest",
        apply: "build",

        configResolved(config) {
            state.outDir = resolve(config.root, config.build.outDir);
        },

        generateBundle(_options, bundle) {
            const ids = Object.values(bundle).flatMap((output) => (output.type === "chunk" ? output.moduleIds : []));

            const manifest: BuildManifest = {
                generator: BUILD_MANIFEST_GENERATOR,
                formatVersion: BUILD_MANIFEST_FORMAT_VERSION,
                schemas: collector.schemas,
                packages: packagesFor(state.outDir, ids),
            };

            this.emitFile({
                type: "asset",
                fileName: BUILD_MANIFEST_FILENAME,
                source: renderManifest(manifest),
            });
        },
    };
}

export { gtkxBuildManifest };

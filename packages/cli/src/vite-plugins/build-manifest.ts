import type { Plugin } from "vite";
import { sortStringsBy } from "@gtkx/utils";
import { realpathSync } from "node:fs";
import { dirname, sep } from "node:path";
import { BINDING_FILENAME } from "../deploy/native-addon.js";
import { bundledNotices } from "../deploy/notices/bundled.js";
import { packageNotice } from "../deploy/notices/packages.js";
import { renderNoticeSections } from "../deploy/notices/render.js";
import { type PackageManifest, readPackageManifest } from "../deploy/settings/package-manifest.js";
import {
    BUILD_MANIFEST_FILENAME,
    BUILD_MANIFEST_FORMAT_VERSION,
    BUILD_MANIFEST_GENERATOR,
    BUILD_NOTICES_FILENAME,
    type BuildManifest,
    type BuildManifestCollector,
    type RecordedPackage,
} from "../internal/build-manifest.js";
import { BUNDLE_FILENAME } from "./esm-extension.js";
import { stripQuery } from "./strip-query.js";

type PackageSource = {
    dir: string;
    manifest: PackageManifest & { name: string };
};

type BuildConfigIdentity = {
    configFile: string;
    configDigest: string;
};

const JSON_INDENT = 4;
const NODE_MODULES = "node_modules";

const packageIn = (dir: string): PackageSource | null => {
    const manifest = readPackageManifest(dir);

    if (manifest.name !== null) {
        return { dir, manifest: { ...manifest, name: manifest.name } };
    }

    const parent = dirname(dir);

    return parent === dir ? null : packageIn(parent);
};

const packageForModule = (id: string): PackageSource | null => {
    const path = stripQuery(id);

    return path.startsWith("/") ? packageIn(dirname(path)) : null;
};

const packageKey = ({ manifest }: PackageSource): string => `${manifest.name}@${manifest.version ?? ""}`;

const isInstalled = ({ dir }: PackageSource): boolean => realpathSync(dir).split(sep).includes(NODE_MODULES);

const packagesFor = (ids: string[]): RecordedPackage[] => {
    const found = ids
        .map((id) => packageForModule(id))
        .filter((entry) => entry !== null)
        .filter(isInstalled);
    const unique = new Map(found.map((entry) => [packageKey(entry), entry]));

    return sortStringsBy(unique.values(), packageKey).map(({ dir, manifest }) => ({
        name: manifest.name,
        version: manifest.version,
        ...packageNotice(dir, manifest),
    }));
};

const renderManifest = (manifest: BuildManifest): string => `${JSON.stringify(manifest, null, JSON_INDENT)}\n`;

function gtkxBuildManifest(collector: BuildManifestCollector, identity: BuildConfigIdentity): Plugin {
    return {
        name: "gtkx:build-manifest",
        apply: "build",

        generateBundle(_options, bundle) {
            const ids = Object.values(bundle).flatMap((output) => (output.type === "chunk" ? output.moduleIds : []));

            const packages = packagesFor(ids);
            const manifest: BuildManifest = {
                generator: BUILD_MANIFEST_GENERATOR,
                formatVersion: BUILD_MANIFEST_FORMAT_VERSION,
                ...identity,
                schemas: collector.schemas,
                packages,
            };

            this.emitFile({
                type: "asset",
                fileName: BUILD_MANIFEST_FILENAME,
                source: renderManifest(manifest),
            });
            this.emitFile({
                type: "asset",
                fileName: BUILD_NOTICES_FILENAME,
                source: renderNoticeSections(bundledNotices(BUNDLE_FILENAME, BINDING_FILENAME, packages)),
            });
        },
    };
}

export { gtkxBuildManifest };

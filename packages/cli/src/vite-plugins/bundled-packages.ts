import type { Plugin } from "vite";
import { isRecord, sortStringsBy } from "@gtkx/utils";
import { readFileSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { stripQuery } from "./strip-query.js";

type PackageIdentity = {
    name: string;
    version: string | null;
};

type RecordedPackage = PackageIdentity & {
    dir: string;
};

type PackagesState = {
    outDir: string;
};

const BUNDLED_PACKAGES_FILENAME = "gtkx-packages.json";
const MANIFEST_FILENAME = "package.json";
const DEFAULT_OUT_DIR = "dist";
const JSON_INDENT = 4;

const identityIn = (dir: string): PackageIdentity | null => {
    try {
        const parsed: unknown = JSON.parse(readFileSync(join(dir, MANIFEST_FILENAME), "utf8"));

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

const keyFor = (entry: RecordedPackage): string => `${entry.name}@${entry.version ?? ""}`;

const relativeTo = (outDir: string, entry: RecordedPackage): RecordedPackage => ({
    ...entry,
    dir: relative(outDir, entry.dir),
});

const renderPackages = (outDir: string, ids: string[]): string => {
    const found = ids.map((id) => packageForModule(id)).filter((entry) => entry !== null);
    const unique: Map<string, RecordedPackage> = new Map(found.map((entry) => [keyFor(entry), entry]));
    const packages = sortStringsBy(unique.values(), keyFor).map((entry) => relativeTo(outDir, entry));

    return `${JSON.stringify({ packages }, null, JSON_INDENT)}\n`;
};

function gtkxBundledPackages(root: string): Plugin {
    const state: PackagesState = { outDir: join(root, DEFAULT_OUT_DIR) };

    return {
        name: "gtkx:bundled-packages",
        apply: "build",

        configResolved(config) {
            state.outDir = resolve(config.root, config.build.outDir);
        },

        generateBundle(_options, bundle) {
            const ids = Object.values(bundle).flatMap((output) => (output.type === "chunk" ? output.moduleIds : []));

            this.emitFile({
                type: "asset",
                fileName: BUNDLED_PACKAGES_FILENAME,
                source: renderPackages(state.outDir, ids),
            });
        },
    };
}

export { BUNDLED_PACKAGES_FILENAME, gtkxBundledPackages };

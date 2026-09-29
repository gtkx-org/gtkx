import type { KnipConfig } from "knip";
import { existsSync, globSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import base from "../knip.json" with { type: "json" };

type PackageManifest = {
    private?: boolean;
    exports?: Record<string, string | { source?: string; default?: string }>;
};

type Configuration = Extract<KnipConfig, { workspaces?: unknown }>;
type WorkspaceConfig = NonNullable<Configuration["workspaces"]>[string];

const root = join(import.meta.dirname, "..");
const defaults = base as Configuration;
const packages = globSync("packages/*/package.json", { cwd: root }).map((path) => ({
    path: dirname(path),
    manifest: JSON.parse(readFileSync(join(root, path), "utf8")) as PackageManifest,
}));

const ignoredProductionDependencies: Record<string, string[]> = {
    "packages/animated": ["@react-spring/types"],
    "packages/cli": ["react", "@gtkx/react", "@gtkx/testing"],
    "packages/codegen": ["@gtkx/cairo"],
    "packages/gl": ["@gtkx/native"],
};

const publicEntries = (manifest: PackageManifest): string[] =>
    Object.values(manifest.exports ?? {}).flatMap((entry) => {
        const source = typeof entry === "string" ? entry : entry.source ?? entry.default;

        return source !== undefined && /\.(?:[cm]?[jt]s|[jt]sx)$/.test(source) ? [`${source}!`] : [];
    });

const workspaceConfig = (path: string, manifest: PackageManifest): WorkspaceConfig => {
    const existing = defaults.workspaces?.[path] ?? {};
    const entries = Array.isArray(existing.entry) ? existing.entry : [existing.entry ?? ""];

    return {
        ...existing,
        includeEntryExports: false,
        entry: [
            ...entries.filter((entry) => entry.startsWith("src/") && entry.endsWith("!")),
            ...publicEntries(manifest),
            ...(existsSync(join(root, path, "src/cli.ts")) ? ["src/cli.ts!"] : []),
        ],
        project: ["src/**/*.{ts,tsx,mts,cts,js,jsx,mjs,cjs}!", "bin/**/*.{js,mjs,cjs}!", "*.{js,mjs,cjs,d.ts}!"],
        ignoreDependencies: [
            ...(existing.ignoreDependencies ?? []),
            "^@gtkx/gi(/.*)?$",
            "^@gtkx/jsx(/.*)?$",
            ...(ignoredProductionDependencies[path] ?? []),
        ],
    };
};

const config: Configuration = {
    ...defaults,
    ignoreWorkspaces: [
        ".",
        "scripts",
        "examples/*",
        "website",
        ...packages.filter(({ manifest }) => manifest.private === true).map(({ path }) => path),
    ],
    workspaces: Object.fromEntries(packages
        .filter(({ manifest }) => manifest.private !== true)
        .map(({ path, manifest }) => [path, workspaceConfig(path, manifest)])),
};

export default config;

import { existsSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join, matchesGlob, posix, relative, sep } from "node:path";
import { type Document, isMap, parse, parseDocument, stringify } from "yaml";
import type { PackageManager } from "./package-managers.js";
import { updateManifest } from "./manifest.js";

type PnpmWorkspace = {
    file: string;
    missingAllowances: string[];
};

const BUILT_DEPENDENCIES = ["@swc/core", "esbuild"];
const PNPM_WORKSPACE_FILE = "pnpm-workspace.yaml";
const YARN_CONFIG_FILE = ".yarnrc.yml";
const PACKAGE_JSON_FILE = "package.json";
const NEGATION_PREFIX = "!";

const isRecord = (value: unknown): value is Record<string, unknown> =>
    typeof value === "object" && value !== null && !Array.isArray(value);

const updateYamlFile = (path: string, update: (document: Document) => void): void => {
    const document = parseDocument(existsSync(path) ? readFileSync(path, "utf8") : "");
    update(document);
    rmSync(path, { force: true });
    writeFileSync(path, document.toString());
};

const writePnpmAllowance = (root: string): void => {
    updateYamlFile(join(root, PNPM_WORKSPACE_FILE), (document) => {
        if (!document.has("packages")) {
            document.set("packages", document.createNode(["."]));
        }

        if (!isMap(document.get("allowBuilds"))) {
            document.set("allowBuilds", document.createNode({}));
        }

        for (const name of BUILT_DEPENDENCIES) {
            document.setIn(["allowBuilds", name], true);
        }
    });
};

const writeNpmAllowance = (root: string): void => {
    updateManifest(root, (manifest) => {
        manifest.allowScripts = Object.fromEntries(BUILT_DEPENDENCIES.map((name) => [name, true]));
    });
};

const writeYarnAllowance = (root: string): void => {
    updateYamlFile(join(root, YARN_CONFIG_FILE), (document) => {
        document.set("nodeLinker", "node-modules");
    });
    updateManifest(root, (manifest) => {
        manifest.dependenciesMeta = Object.fromEntries(BUILT_DEPENDENCIES.map((name) => [name, { built: true }]));
    });
};

/**
 * Configures the package manager to run the build scripts of the scaffold's native dependencies, adding
 * to an existing `pnpm-workspace.yaml` or `.yarnrc.yml` instead of replacing it.
 */
const writeBuildAllowance = (root: string, packageManager: PackageManager): void => {
    if (packageManager === "pnpm") {
        writePnpmAllowance(root);

        return;
    }

    if (packageManager === "yarn") {
        writeYarnAllowance(root);

        return;
    }

    writeNpmAllowance(root);
};

const PACKAGE_MANAGER_CONFIG_FILES: Record<PackageManager, string[]> = {
    pnpm: [PNPM_WORKSPACE_FILE],
    yarn: [YARN_CONFIG_FILE],
    npm: [],
};

/**
 * The `packageManager` field of the project's existing `package.json` when it names `packageManager`, so
 * replacing the manifest keeps the version the project pins.
 */
const pinnedPackageManager = (root: string, packageManager: PackageManager): string | null => {
    const path = join(root, PACKAGE_JSON_FILE);

    if (!existsSync(path)) {
        return null;
    }

    try {
        const manifest: unknown = JSON.parse(readFileSync(path, "utf8"));
        const pin = isRecord(manifest) ? manifest.packageManager : undefined;

        return typeof pin === "string" && pin.startsWith(`${packageManager}@`) ? pin : null;
    } catch {
        return null;
    }
};

const nearestPnpmWorkspaceFile = (root: string): string | null => {
    for (let directory = dirname(root); ; directory = dirname(directory)) {
        const file = join(directory, PNPM_WORKSPACE_FILE);

        if (existsSync(file)) {
            return file;
        }

        if (dirname(directory) === directory) {
            return null;
        }
    }
};

const workspacePatterns = (settings: unknown): string[] => {
    const packages = isRecord(settings) ? settings.packages : undefined;

    return Array.isArray(packages) ? packages.filter((pattern) => typeof pattern === "string") : [];
};

const matchesWorkspacePattern = (project: string, pattern: string): boolean =>
    matchesGlob(project, posix.normalize(pattern).replace(/\/+$/, ""));

const includesProject = (patterns: string[], project: string): boolean =>
    patterns.some((pattern) => !pattern.startsWith(NEGATION_PREFIX) && matchesWorkspacePattern(project, pattern)) &&
    !patterns.some(
        (pattern) =>
            pattern.startsWith(NEGATION_PREFIX) &&
            matchesWorkspacePattern(project, pattern.slice(NEGATION_PREFIX.length)),
    );

/**
 * The pnpm workspace above `root` whose `packages` include it, with the native dependencies whose build
 * scripts its `allowBuilds` does not mention yet, or null when `root` is not part of an enclosing workspace.
 */
const enclosingPnpmWorkspace = (root: string): PnpmWorkspace | null => {
    const file = nearestPnpmWorkspaceFile(root);

    if (file === null) {
        return null;
    }

    const settings: unknown = parse(readFileSync(file, "utf8"));
    const project = relative(dirname(file), root).split(sep).join(posix.sep);

    if (!includesProject(workspacePatterns(settings), project)) {
        return null;
    }

    const allowBuilds = isRecord(settings) && isRecord(settings.allowBuilds) ? settings.allowBuilds : {};

    return { file, missingAllowances: BUILT_DEPENDENCIES.filter((name) => !Object.hasOwn(allowBuilds, name)) };
};

/**
 * The `allowBuilds` entries to add to a workspace's `pnpm-workspace.yaml`, as YAML.
 */
const formatMissingAllowances = (workspace: PnpmWorkspace): string =>
    stringify({ allowBuilds: Object.fromEntries(workspace.missingAllowances.map((name) => [name, true])) }).trimEnd();

export {
    PACKAGE_MANAGER_CONFIG_FILES,
    enclosingPnpmWorkspace,
    formatMissingAllowances,
    pinnedPackageManager,
    type PnpmWorkspace,
    writeBuildAllowance,
};

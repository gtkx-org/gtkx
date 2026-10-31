import { existsSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join, matchesGlob, posix, relative, sep } from "node:path";
import { type Document, isMap, parse, parseDocument, stringify } from "yaml";
import type { PackageManager } from "./package-managers.js";
import { updateManifest } from "./manifest.js";

type MissingSetting = {
    file: string;
    entries: string;
};

type Workspace = {
    packageManager: PackageManager;
    missingSettings: MissingSetting[];
};

const BUILT_DEPENDENCIES = ["@swc/core", "esbuild"];
const YARN_NODE_LINKER = "node-modules";
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
        document.set("nodeLinker", YARN_NODE_LINKER);
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

const workspacePatterns = (settings: unknown, field: string): string[] => {
    const patterns = isRecord(settings) ? settings[field] : undefined;

    return Array.isArray(patterns) ? patterns.filter((pattern) => typeof pattern === "string") : [];
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

const ancestorFiles = (root: string, name: string): string[] => {
    const files: string[] = [];

    for (let directory = dirname(root); ; directory = dirname(directory)) {
        const file = join(directory, name);

        if (existsSync(file)) {
            files.push(file);
        }

        if (dirname(directory) === directory) {
            return files;
        }
    }
};

const projectPath = (file: string, root: string): string => relative(dirname(file), root).split(sep).join(posix.sep);

const recordField = (settings: unknown, field: string): Record<string, unknown> =>
    isRecord(settings) && isRecord(settings[field]) ? settings[field] : {};

const missingBuilds = (allowances: Record<string, unknown>): string[] =>
    BUILT_DEPENDENCIES.filter((name) => !Object.hasOwn(allowances, name));

const settingsToAdd = (settings: (MissingSetting | null)[]): MissingSetting[] =>
    settings.filter((setting) => setting !== null);

const pnpmWorkspaceAt = (file: string, project: string): Workspace | null => {
    const settings: unknown = parse(readFileSync(file, "utf8"));

    if (!includesProject(workspacePatterns(settings, "packages"), project)) {
        return null;
    }

    const missing = missingBuilds(recordField(settings, "allowBuilds"));
    const entries = stringify({ allowBuilds: Object.fromEntries(missing.map((name) => [name, true])) }).trimEnd();

    return { packageManager: "pnpm", missingSettings: settingsToAdd([missing.length > 0 ? { file, entries } : null]) };
};

const npmWorkspaceAt = (file: string, project: string): Workspace | null => {
    const manifest: unknown = JSON.parse(readFileSync(file, "utf8"));

    if (!includesProject(workspacePatterns(manifest, "workspaces"), project)) {
        return null;
    }

    const missing = missingBuilds(recordField(manifest, "allowScripts"));
    const entries = `"allowScripts": ${JSON.stringify(Object.fromEntries(missing.map((name) => [name, true])), null, 4)}`;

    return { packageManager: "npm", missingSettings: settingsToAdd([missing.length > 0 ? { file, entries } : null]) };
};

/**
 * The `nodeLinker` Yarn applies in `directory`: Yarn merges the `.yarnrc.yml` files of a project and its
 * ancestors, and the closest one that sets a value wins.
 */
const yarnNodeLinker = (directory: string): unknown => {
    for (const file of [join(directory, YARN_CONFIG_FILE), ...ancestorFiles(directory, YARN_CONFIG_FILE)]) {
        const settings: unknown = existsSync(file) ? parse(readFileSync(file, "utf8")) : undefined;

        if (isRecord(settings) && Object.hasOwn(settings, "nodeLinker")) {
            return settings.nodeLinker;
        }
    }

    return undefined;
};

const yarnWorkspaceAt = (file: string, project: string): Workspace | null => {
    const manifest: unknown = JSON.parse(readFileSync(file, "utf8"));

    if (!includesProject(workspacePatterns(manifest, "workspaces"), project)) {
        return null;
    }

    const missing = missingBuilds(recordField(manifest, "dependenciesMeta"));
    const dependenciesMeta = Object.fromEntries(missing.map((name) => [name, { built: true }]));
    const configFile = join(dirname(file), YARN_CONFIG_FILE);

    return {
        packageManager: "yarn",
        missingSettings: settingsToAdd([
            yarnNodeLinker(dirname(file)) === YARN_NODE_LINKER
                ? null
                : { file: configFile, entries: stringify({ nodeLinker: YARN_NODE_LINKER }).trimEnd() },
            missing.length > 0
                ? { file, entries: `"dependenciesMeta": ${JSON.stringify(dependenciesMeta, null, 4)}` }
                : null,
        ]),
    };
};

const MANIFEST_WORKSPACES: Record<
    Exclude<PackageManager, "pnpm">,
    (file: string, project: string) => Workspace | null
> = {
    npm: npmWorkspaceAt,
    yarn: yarnWorkspaceAt,
};

/**
 * The pnpm, npm or Yarn workspace above `root` that includes it, with the settings its root configuration
 * still lacks for the app, or null when `root` is not part of an enclosing workspace. pnpm reads
 * `allowBuilds`, npm `allowScripts`, and Yarn `nodeLinker` and `dependenciesMeta` only for the whole
 * workspace, from its root.
 */
const enclosingWorkspace = (root: string, packageManager: PackageManager): Workspace | null => {
    if (packageManager === "pnpm") {
        const [nearest] = ancestorFiles(root, PNPM_WORKSPACE_FILE);

        return nearest === undefined ? null : pnpmWorkspaceAt(nearest, projectPath(nearest, root));
    }

    const workspaceAt = MANIFEST_WORKSPACES[packageManager];

    for (const file of ancestorFiles(root, PACKAGE_JSON_FILE)) {
        const workspace = workspaceAt(file, projectPath(file, root));

        if (workspace !== null) {
            return workspace;
        }
    }

    return null;
};

export { PACKAGE_MANAGER_CONFIG_FILES, enclosingWorkspace, pinnedPackageManager, type Workspace, writeBuildAllowance };

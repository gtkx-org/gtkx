import { tryResolveExecutable } from "@gtkx/utils";
import { execFileSync } from "node:child_process";
import { existsSync, lstatSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join, matchesGlob, posix, relative, sep } from "node:path";
import { type Document, isMap, isSeq, parse, parseDocument, stringify } from "yaml";
import type { PackageManager } from "./package-managers.js";
import { updateManifest } from "./manifest.js";

type MissingSetting = {
    file: string;
    section: string | null;
    entries: string;
};

type Workspace = {
    packageManager: PackageManager;
    root: string;
    member: string;
    missingSettings: MissingSetting[];
};

const BUILT_DEPENDENCIES = ["@swc/core", "esbuild"];
const RELEASE_AGE_EXEMPT_PACKAGES = ["@gtkx/*", "create-gtkx"];
const YARN_NODE_LINKER = "node-modules";
const PNPM_WORKSPACE_FILE = "pnpm-workspace.yaml";
const YARN_CONFIG_FILE = ".yarnrc.yml";
const NPM_CONFIG_FILE = ".npmrc";
const PACKAGE_JSON_FILE = "package.json";
const PNPM_RELEASE_AGE_EXCLUDE = "minimumReleaseAgeExclude";
const YARN_PREAPPROVED_PACKAGES = "npmPreapprovedPackages";
const NPM_RELEASE_AGE_EXCLUDE = "min-release-age-exclude[]";
const NPM_RELEASE_AGE_EXCLUDE_PATTERN = /^\s*min-release-age-exclude(?:\[\])?\s*=\s*(["']?)(.*?)\1\s*$/;
const NEGATION_PREFIX = "!";
const YARN_USER_AGENT_PATTERN = /^yarn\/((\d+)\.\d+\.\d+\S*)/;
const FIRST_PINNED_YARN_MAJOR = 2;
const YARN_PIN_PATTERN = /^yarn@(\d+)\./;
const YARN_PIN_PREFIX = "yarn@";
const YARN_RELEASE_PATTERN = /^(\d+)\.(\d+)\./;
const FIRST_PREAPPROVING_YARN = { major: 4, minor: 10 };

const isRecord = (value: unknown): value is Record<string, unknown> =>
    typeof value === "object" && value !== null && !Array.isArray(value);

const readSettings = (path: string, read: (source: string) => unknown): unknown => {
    try {
        return read(readFileSync(path, "utf8"));
    } catch {
        return undefined;
    }
};

/**
 * Writes `contents` to a new file at `path` in place of a file or symlink there, keeping the permissions of a
 * replaced file, such as a private `.npmrc` that holds registry credentials.
 */
const replaceFile = (path: string, contents: string): void => {
    const replaced = lstatSync(path, { throwIfNoEntry: false });

    rmSync(path, { force: true });
    writeFileSync(path, contents, { mode: replaced?.isFile() ? replaced.mode & 0o777 : undefined });
};

const updateYamlFile = (path: string, update: (document: Document) => void): void => {
    const document = parseDocument(existsSync(path) ? readFileSync(path, "utf8") : "");
    update(document);
    replaceFile(path, document.toString());
};

const missingExemptions = (exempted: unknown): string[] =>
    RELEASE_AGE_EXEMPT_PACKAGES.filter((name) => !Array.isArray(exempted) || !exempted.includes(name));

const addReleaseAgeExemptions = (document: Document, key: string): void => {
    const current = document.get(key);
    const missing = missingExemptions(isSeq(current) ? current.toJSON() : []);

    if (!isSeq(current)) {
        document.set(key, document.createNode([]));
    }

    for (const name of missing) {
        document.addIn([key], name);
    }
};

const npmExemptions = (source: string): string[] =>
    source.split(/\r?\n/).flatMap((line) => {
        const value = NPM_RELEASE_AGE_EXCLUDE_PATTERN.exec(line)?.[2];

        return value === undefined ? [] : [value];
    });

const npmExemptionLines = (names: string[]): string =>
    names.map((name) => `${NPM_RELEASE_AGE_EXCLUDE}=${name}`).join("\n");

const writeNpmExemptions = (root: string): string[] => {
    const path = join(root, NPM_CONFIG_FILE);
    const source = existsSync(path) ? readFileSync(path, "utf8") : "";
    const missing = missingExemptions(npmExemptions(source));

    if (missing.length === 0) {
        return [];
    }

    const separator = source === "" || source.endsWith("\n") ? "" : "\n";
    replaceFile(path, `${source}${separator}${npmExemptionLines(missing)}\n`);

    return [path];
};

const writeYamlExemptions = (path: string, key: string): string[] => {
    const settings = readSettings(path, parse);

    if (missingExemptions(isRecord(settings) ? settings[key] : undefined).length === 0) {
        return [];
    }

    updateYamlFile(path, (document) => addReleaseAgeExemptions(document, key));

    return [path];
};

const reportedYarnRelease = (root: string): string | null => {
    const corepack = tryResolveExecutable("corepack");
    const command = corepack ?? tryResolveExecutable("yarn");

    if (command === undefined) {
        return null;
    }

    try {
        return execFileSync(command, corepack === undefined ? ["--version"] : ["yarn", "--version"], {
            cwd: root,
            encoding: "utf8",
            stdio: ["ignore", "pipe", "ignore"],
        }).trim();
    } catch {
        return null;
    }
};

/**
 * The Yarn release that installs a project without a pin at `root`: the Yarn running the scaffold, otherwise the
 * one `yarn --version` reports there through Corepack.
 */
const installingYarnRelease = (root: string): string | null =>
    YARN_USER_AGENT_PATTERN.exec(process.env.npm_config_user_agent ?? "")?.[1] ?? reportedYarnRelease(root);

/**
 * The Yarn release that installs the project at `root`: the release its `packageManager` field pins, otherwise
 * the Yarn running the scaffold, otherwise the one `yarn --version` reports there through Corepack, as the
 * install runs it.
 */
const yarnRelease = (root: string): string | null => {
    const manifest = readSettings(join(root, PACKAGE_JSON_FILE), JSON.parse);
    const pin = isRecord(manifest) && typeof manifest.packageManager === "string" ? manifest.packageManager : "";

    if (pin.startsWith(YARN_PIN_PREFIX)) {
        return pin.slice(YARN_PIN_PREFIX.length);
    }

    return installingYarnRelease(root);
};

/**
 * Whether the Yarn installing the project at `root` reads `npmPreapprovedPackages`. Yarn 4.10 added it next to
 * its release-age gate, and older releases refuse to run with a setting they do not know.
 */
const readsPreapprovedPackages = (root: string): boolean => {
    const matched = YARN_RELEASE_PATTERN.exec(yarnRelease(root) ?? "");
    const major = Number(matched?.[1]);
    const minor = Number(matched?.[2]);

    return (
        major > FIRST_PREAPPROVING_YARN.major ||
        (major === FIRST_PREAPPROVING_YARN.major && minor >= FIRST_PREAPPROVING_YARN.minor)
    );
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

        addReleaseAgeExemptions(document, PNPM_RELEASE_AGE_EXCLUDE);
    });
};

const writeNpmAllowance = (root: string): void => {
    updateManifest(root, (manifest) => {
        manifest.allowScripts = Object.fromEntries(BUILT_DEPENDENCIES.map((name) => [name, true]));
    });
    writeNpmExemptions(root);
};

const writeYarnAllowance = (root: string): void => {
    const isPreapproving = readsPreapprovedPackages(root);

    updateYamlFile(join(root, YARN_CONFIG_FILE), (document) => {
        document.set("nodeLinker", YARN_NODE_LINKER);

        if (isPreapproving) {
            addReleaseAgeExemptions(document, YARN_PREAPPROVED_PACKAGES);
        }
    });
    updateManifest(root, (manifest) => {
        manifest.dependenciesMeta = Object.fromEntries(BUILT_DEPENDENCIES.map((name) => [name, { built: true }]));
    });
};

/**
 * Configures the package manager to run the build scripts of the scaffold's native dependencies and to exempt
 * GTKX's own packages from its release-age gate, so a project created on the day of a GTKX release installs it.
 * Adds to an existing `pnpm-workspace.yaml`, `.yarnrc.yml` or `.npmrc` instead of replacing it.
 */
const writePackageManagerSettings = (root: string, packageManager: PackageManager): void => {
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

const RELEASE_AGE_EXEMPTION_WRITERS: Record<PackageManager, (root: string) => string[]> = {
    pnpm: (root) => writeYamlExemptions(join(root, PNPM_WORKSPACE_FILE), PNPM_RELEASE_AGE_EXCLUDE),
    yarn: (root) =>
        readsPreapprovedPackages(root)
            ? writeYamlExemptions(join(root, YARN_CONFIG_FILE), YARN_PREAPPROVED_PACKAGES)
            : [],
    npm: writeNpmExemptions,
};

/**
 * Exempts GTKX's own packages from the release-age gate of the package manager that installs the project or
 * workspace at `root`, adding only the entries its `pnpm-workspace.yaml`, `.yarnrc.yml` (Yarn 4.10 or newer)
 * or `.npmrc` lacks and keeping everything else in it, and returns the files it changed.
 */
const writeReleaseAgeExemptions = (root: string, packageManager: PackageManager): string[] =>
    RELEASE_AGE_EXEMPTION_WRITERS[packageManager](root);

const PACKAGE_MANAGER_CONFIG_FILES: Record<PackageManager, string[]> = {
    pnpm: [PNPM_WORKSPACE_FILE],
    yarn: [YARN_CONFIG_FILE],
    npm: [NPM_CONFIG_FILE],
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

const nearestDirectory = (path: string): string =>
    existsSync(path) || dirname(path) === path ? path : nearestDirectory(dirname(path));

/**
 * The `packageManager` pin for the Yarn 2 or newer release that installs a new project at `root`, as
 * `yarn init -2` writes it, or null when that is Yarn 1. The project may not exist yet, so Corepack is asked in
 * its nearest existing directory, which resolves the same release for a project without a pin.
 */
const installingYarnPin = (root: string): string | null => {
    const release = installingYarnRelease(nearestDirectory(root));
    const major = Number(YARN_RELEASE_PATTERN.exec(release ?? "")?.[1]);

    return release !== null && major >= FIRST_PINNED_YARN_MAJOR ? `${YARN_PIN_PREFIX}${release}` : null;
};

/**
 * The `packageManager` field for the new `package.json`: the existing project's pin when it names
 * `packageManager`, otherwise, outside an enclosing workspace whose root owns the pin, the Yarn 2 or newer
 * release that installs the project.
 */
const packageManagerPin = (root: string, packageManager: PackageManager, isInWorkspace: boolean): string | null =>
    pinnedPackageManager(root, packageManager) ??
    (packageManager === "yarn" && !isInWorkspace ? installingYarnPin(root) : null);

/**
 * The workspace globs of `field`, given as a list or, as npm and Yarn also accept, as an object with a
 * `packages` list.
 */
const workspacePatterns = (settings: unknown, field: string): string[] => {
    const value = isRecord(settings) ? settings[field] : undefined;
    const patterns = isRecord(value) ? value.packages : value;

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

const missingYamlExemptions = (file: string, settings: unknown, key: string): MissingSetting | null => {
    const listed = isRecord(settings) ? settings[key] : undefined;
    const missing = missingExemptions(listed);

    if (missing.length === 0) {
        return null;
    }

    return Array.isArray(listed)
        ? { file, section: key, entries: stringify(missing).trimEnd().replace(/^/gm, "  ") }
        : { file, section: null, entries: stringify({ [key]: missing }).trimEnd() };
};

const pnpmWorkspaceAt = (file: string, project: string): Workspace | null => {
    const settings: unknown = parse(readFileSync(file, "utf8"));

    if (!includesProject(workspacePatterns(settings, "packages"), project)) {
        return null;
    }

    const allowances = recordField(settings, "allowBuilds");
    const missing = BUILT_DEPENDENCIES.filter((name) => typeof allowances[name] !== "boolean");
    const required = Object.fromEntries(missing.map((name) => [name, true]));
    const setting: MissingSetting =
        isRecord(settings) && isRecord(settings.allowBuilds)
            ? { file, section: "allowBuilds", entries: stringify(required).trimEnd().replace(/^/gm, "  ") }
            : { file, section: null, entries: stringify({ allowBuilds: required }).trimEnd() };

    return {
        packageManager: "pnpm",
        root: dirname(file),
        member: project,
        missingSettings: settingsToAdd([
            missing.length > 0 ? setting : null,
            missingYamlExemptions(file, settings, PNPM_RELEASE_AGE_EXCLUDE),
        ]),
    };
};

const npmWorkspaceAt = (file: string, project: string): Workspace | null => {
    const manifest: unknown = JSON.parse(readFileSync(file, "utf8"));

    if (!includesProject(workspacePatterns(manifest, "workspaces"), project)) {
        return null;
    }

    const missing = missingBuilds(recordField(manifest, "allowScripts"));
    const entries = `"allowScripts": ${JSON.stringify(Object.fromEntries(missing.map((name) => [name, true])), null, 4)}`;
    const configFile = join(dirname(file), NPM_CONFIG_FILE);
    const exemptions = missingExemptions(npmExemptions(existsSync(configFile) ? readFileSync(configFile, "utf8") : ""));

    return {
        packageManager: "npm",
        root: dirname(file),
        member: project,
        missingSettings: settingsToAdd([
            missing.length > 0 ? { file, section: null, entries } : null,
            exemptions.length > 0 ? { file: configFile, section: null, entries: npmExemptionLines(exemptions) } : null,
        ]),
    };
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
    const exemptions = readsPreapprovedPackages(dirname(file))
        ? missingYamlExemptions(configFile, readSettings(configFile, parse), YARN_PREAPPROVED_PACKAGES)
        : null;

    return {
        packageManager: "yarn",
        root: dirname(file),
        member: project,
        missingSettings: settingsToAdd([
            yarnNodeLinker(dirname(file)) === YARN_NODE_LINKER
                ? null
                : { file: configFile, section: null, entries: stringify({ nodeLinker: YARN_NODE_LINKER }).trimEnd() },
            missing.length > 0
                ? { file, section: null, entries: `"dependenciesMeta": ${JSON.stringify(dependenciesMeta, null, 4)}` }
                : null,
            exemptions,
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
 * `allowBuilds` and `minimumReleaseAgeExclude`, npm `allowScripts` and `min-release-age-exclude`, and Yarn
 * `nodeLinker`, `npmPreapprovedPackages` and `dependenciesMeta` only for the whole workspace, from its root.
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

/**
 * Whether `yarn` in the workspace at `root` is Yarn 1: the major its `packageManager` pin names, otherwise
 * Yarn 2 or newer when its `.yarnrc.yml` sets `yarnPath`, otherwise the Yarn running the scaffold, and Yarn 1,
 * which an unpinned `yarn` runs through Corepack, when none of these says.
 */
const isClassicYarn = (root: string): boolean => {
    const manifest = readSettings(join(root, PACKAGE_JSON_FILE), JSON.parse);
    const pin = isRecord(manifest) && typeof manifest.packageManager === "string" ? manifest.packageManager : "";
    const pinnedMajor = YARN_PIN_PATTERN.exec(pin)?.[1];

    if (pinnedMajor !== undefined) {
        return Number(pinnedMajor) < FIRST_PINNED_YARN_MAJOR;
    }

    const settings = readSettings(join(root, YARN_CONFIG_FILE), parse);

    if (isRecord(settings) && typeof settings.yarnPath === "string") {
        return false;
    }

    const runningMajor = YARN_USER_AGENT_PATTERN.exec(process.env.npm_config_user_agent ?? "")?.[2];

    return runningMajor === undefined || Number(runningMajor) < FIRST_PINNED_YARN_MAJOR;
};

export {
    PACKAGE_MANAGER_CONFIG_FILES,
    enclosingWorkspace,
    isClassicYarn,
    packageManagerPin,
    type Workspace,
    writePackageManagerSettings,
    writeReleaseAgeExemptions,
};

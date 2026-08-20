import { existsSync, readFileSync, realpathSync, rmSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { EXTERNAL_NAMESPACES, type ExternalNamespace } from "../gir/external-namespaces.js";
import { nodeModulesChain } from "./resolve-store.js";
import { type StoreLink, symlinkRelative } from "./store-fs.js";

type ExternalPackageSource = "store" | "hoisted" | "codegen";

type ExternalPackageResolution = {
    packageName: string;
    directory: string;
    dir: string;
    source: ExternalPackageSource;
};

const DEPENDENCY_FIELDS = ["dependencies", "devDependencies", "peerDependencies", "optionalDependencies"];
const codegenRequire = createRequire(import.meta.url);
const codegenPackageDirs: Map<string, string | undefined> = new Map();
const ensuredStores: Set<string> = new Set();

const storeAnchor = (link: StoreLink): string => dirname(dirname(link.linkDir));
const namespaceShimDirectory = (entry: ExternalNamespace): string => entry.namespace.toLowerCase();

const resolveFromStore = (link: StoreLink, packageName: string): string | undefined => {
    const chain = nodeModulesChain(dirname(storeAnchor(link)));

    for (const nodeModules of chain) {
        const manifest = join(nodeModules, packageName, "package.json");

        if (existsSync(manifest)) {
            return dirname(realpathSync(manifest));
        }
    }

    return undefined;
};

const projectManifestPath = (link: StoreLink): string => join(dirname(storeAnchor(link)), "package.json");

const readManifest = (manifestPath: string): Record<string, unknown> | undefined => {
    try {
        return JSON.parse(readFileSync(manifestPath, "utf8")) as Record<string, unknown>;
    } catch {
        return undefined;
    }
};

const sectionNames = (section: unknown): string[] =>
    typeof section === "object" && section !== null ? Object.keys(section) : [];

const declaredDependencies = (manifest: Record<string, unknown>): Set<string> =>
    new Set(DEPENDENCY_FIELDS.flatMap((field) => sectionNames(manifest[field])));

const isDeclaredByProject = (link: StoreLink, packageName: string): boolean => {
    const manifest = readManifest(projectManifestPath(link));

    return manifest === undefined || declaredDependencies(manifest).has(packageName);
};

const resolveFromCodegen = (packageName: string): string | undefined => {
    if (codegenPackageDirs.has(packageName)) {
        return codegenPackageDirs.get(packageName);
    }

    let dir: string | undefined;

    try {
        dir = dirname(realpathSync(codegenRequire.resolve(`${packageName}/package.json`)));
    } catch {
        dir = undefined;
    }

    codegenPackageDirs.set(packageName, dir);

    return dir;
};

const resolveEntry = (link: StoreLink, entry: ExternalNamespace): ExternalPackageResolution | undefined => {
    const directory = namespaceShimDirectory(entry);
    const chainResolved = resolveFromStore(link, entry.packageName);

    if (chainResolved !== undefined) {
        const source = isDeclaredByProject(link, entry.packageName) ? "store" : "hoisted";

        return { packageName: entry.packageName, directory, dir: chainResolved, source };
    }

    const codegenDir = resolveFromCodegen(entry.packageName);

    if (codegenDir !== undefined) {
        return { packageName: entry.packageName, directory, dir: codegenDir, source: "codegen" };
    }

    return undefined;
};

const resolveExternalPackages = (link: StoreLink): ExternalPackageResolution[] => {
    const resolutions: ExternalPackageResolution[] = [];

    for (const entry of EXTERNAL_NAMESPACES) {
        const resolution = resolveEntry(link, entry);

        if (resolution !== undefined) {
            resolutions.push(resolution);
        }
    }

    return resolutions;
};

const isLinkedTo = (linkPath: string, dir: string): boolean => {
    try {
        return realpathSync(linkPath) === realpathSync(dir);
    } catch {
        return false;
    }
};

const applyLink = (storeDir: string, resolution: ExternalPackageResolution): void => {
    const linkPath = join(storeDir, "node_modules", resolution.packageName);

    if (resolution.source === "codegen") {
        if (!isLinkedTo(linkPath, resolution.dir)) {
            symlinkRelative(linkPath, resolution.dir);
        }

        return;
    }

    rmSync(linkPath, { recursive: true, force: true });
};

const tryApplyLink = (storeDir: string, resolution: ExternalPackageResolution): void => {
    try {
        applyLink(storeDir, resolution);
    } catch {
        return;
    }
};

const ensureExternalPackageLinks = (link: StoreLink): void => {
    if (ensuredStores.has(link.storeDir)) {
        return;
    }

    if (!existsSync(join(link.storeDir, "package.json"))) {
        return;
    }

    for (const resolution of resolveExternalPackages(link)) {
        tryApplyLink(link.storeDir, resolution);
    }

    ensuredStores.add(link.storeDir);
};

const resetExternalPackageLinks = (storeDir: string): void => {
    ensuredStores.delete(storeDir);
};

const externalPackageNotice = (resolution: ExternalPackageResolution): string =>
    `${resolution.packageName} is not installed in this project, so the copy @gtkx/codegen depends on was ` +
    `linked into the generated store; add ${resolution.packageName} to your dependencies, because GTKX 2.0 ` +
    "stops doing this.";

const hoistedPackageNotice = (resolution: ExternalPackageResolution): string =>
    `${resolution.packageName} is not declared in this project's package.json and only resolves because ` +
    `your package manager hoisted it; add ${resolution.packageName} to your dependencies, because GTKX 2.0 ` +
    "requires the direct dependency.";

const hasShim = (storeDir: string, entry: ExternalNamespace): boolean =>
    existsSync(join(storeDir, namespaceShimDirectory(entry), "index.js"));

const hasStoreLocalLink = (storeDir: string, packageName: string): boolean =>
    existsSync(join(storeDir, "node_modules", packageName, "package.json"));

const unresolvableMessage = (link: StoreLink, entry: ExternalNamespace): string =>
    `Cannot resolve ${entry.packageName} from ${storeAnchor(link)} or from @gtkx/codegen; ` +
    "install it next to @gtkx/runtime.";

const linkFailedMessage = (link: StoreLink, entry: ExternalNamespace): string =>
    `Cannot link ${entry.packageName} into the generated store at ${link.storeDir}; ` +
    `install ${entry.packageName} next to @gtkx/runtime.`;

const entryNotice = (link: StoreLink, entry: ExternalNamespace): string | undefined => {
    if (!hasShim(link.storeDir, entry)) {
        return undefined;
    }

    const resolution = resolveEntry(link, entry);

    if (resolution === undefined) {
        throw new Error(unresolvableMessage(link, entry));
    }

    if (resolution.source === "store") {
        return undefined;
    }

    if (resolution.source === "hoisted") {
        return hoistedPackageNotice(resolution);
    }

    if (!hasStoreLocalLink(link.storeDir, resolution.packageName)) {
        throw new Error(linkFailedMessage(link, entry));
    }

    return externalPackageNotice(resolution);
};

const externalPackageNotices = (link: StoreLink): string[] => {
    const notices: string[] = [];

    for (const entry of EXTERNAL_NAMESPACES) {
        const notice = entryNotice(link, entry);

        if (notice !== undefined) {
            notices.push(notice);
        }
    }

    return notices;
};

export { ensureExternalPackageLinks, externalPackageNotices, resetExternalPackageLinks };

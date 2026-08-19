import { existsSync, realpathSync, rmSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { EXTERNAL_NAMESPACES, type ExternalNamespace } from "../gir/external-namespaces.js";
import { nodeModulesChain } from "./resolve-store.js";
import { symlinkRelative } from "./store-fs.js";

type ExternalPackageSource = "store" | "codegen";

type ExternalPackageResolution = {
    packageName: string;
    directory: string;
    dir: string;
    source: ExternalPackageSource;
};

const codegenRequire = createRequire(import.meta.url);
const codegenPackageDirs: Map<string, string | undefined> = new Map();

const storeAnchor = (storeDir: string): string => dirname(dirname(storeDir));
const namespaceShimDirectory = (entry: ExternalNamespace): string => entry.namespace.toLowerCase();

const resolveFromStore = (storeDir: string, packageName: string): string | undefined => {
    const chain = nodeModulesChain(dirname(storeAnchor(storeDir)));

    for (const nodeModules of chain) {
        const manifest = join(nodeModules, packageName, "package.json");

        if (existsSync(manifest)) {
            return dirname(realpathSync(manifest));
        }
    }

    return undefined;
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

const resolveEntry = (storeDir: string, entry: ExternalNamespace): ExternalPackageResolution | undefined => {
    const directory = namespaceShimDirectory(entry);
    const storeDirResolved = resolveFromStore(storeDir, entry.packageName);

    if (storeDirResolved !== undefined) {
        return { packageName: entry.packageName, directory, dir: storeDirResolved, source: "store" };
    }

    const codegenDir = resolveFromCodegen(entry.packageName);

    if (codegenDir !== undefined) {
        return { packageName: entry.packageName, directory, dir: codegenDir, source: "codegen" };
    }

    return undefined;
};

const resolveExternalPackages = (storeDir: string): ExternalPackageResolution[] => {
    const resolutions: ExternalPackageResolution[] = [];

    for (const entry of EXTERNAL_NAMESPACES) {
        const resolution = resolveEntry(storeDir, entry);

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

const ensureExternalPackageLinks = (storeDir: string): void => {
    if (!existsSync(join(storeDir, "package.json"))) {
        return;
    }

    for (const resolution of resolveExternalPackages(storeDir)) {
        tryApplyLink(storeDir, resolution);
    }
};

const externalPackageNotice = (resolution: ExternalPackageResolution): string =>
    `${resolution.packageName} is not installed in this project, so the copy @gtkx/codegen depends on was ` +
    `linked into the generated store; add ${resolution.packageName} to your dependencies, because GTKX 2.0 ` +
    "stops doing this.";

const hasShim = (storeDir: string, entry: ExternalNamespace): boolean =>
    existsSync(join(storeDir, namespaceShimDirectory(entry), "index.js"));

const unresolvableMessage = (storeDir: string, entry: ExternalNamespace): string =>
    `Cannot resolve ${entry.packageName} from ${storeAnchor(storeDir)} or from @gtkx/codegen; ` +
    "install it next to @gtkx/runtime.";

const entryNotice = (storeDir: string, entry: ExternalNamespace): string | undefined => {
    if (!hasShim(storeDir, entry)) {
        return undefined;
    }

    const resolution = resolveEntry(storeDir, entry);

    if (resolution === undefined) {
        throw new Error(unresolvableMessage(storeDir, entry));
    }

    return resolution.source === "codegen" ? externalPackageNotice(resolution) : undefined;
};

const externalPackageNotices = (storeDir: string): string[] => {
    const notices: string[] = [];

    for (const entry of EXTERNAL_NAMESPACES) {
        const notice = entryNotice(storeDir, entry);

        if (notice !== undefined) {
            notices.push(notice);
        }
    }

    return notices;
};

export { ensureExternalPackageLinks, externalPackageNotices };

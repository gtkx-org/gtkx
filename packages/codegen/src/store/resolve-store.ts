import { existsSync, readFileSync, realpathSync } from "node:fs";
import { dirname, join, parse, relative } from "node:path";
import type { StoreOptions } from "./store-fs.js";

/**
 * Where a project's generated stores live, ready to spread into `runCodegen`. `jsx` is null when the
 * project has no `@gtkx/react` installed, in which case only the `@gtkx/gi` store can be generated.
 */
type ResolvedStore = {
    /** The `node_modules` both stores are written into, the one the `@gtkx` packages resolve from. */
    nodeModules: string;
    /** Where the `@gtkx/gi` store goes, versioned by the installed `@gtkx/runtime`. */
    gi: StoreOptions;
    /** Where the `@gtkx/jsx` store goes, versioned by the installed `@gtkx/react`; null when it is absent. */
    jsx: StoreOptions | null;
    /** Subexport names of the installed `@gtkx/react`, empty when it is absent. */
    reactSubexports: string[];
};

type ResolvedPackage = { dir: string; nodeModules: string; version: string };
type Manifest = { version?: string; exports?: Record<string, unknown>; workspaces?: unknown };

const STORE_DIR = ".gtkx";
const SCOPE = "@gtkx";
const STORE_NAMES: string[] = ["gi", "jsx"];

const INSTALL_ROOT_MARKERS: string[] = [
    "bun.lock",
    "bun.lockb",
    "npm-shrinkwrap.json",
    "package-lock.json",
    "pnpm-lock.yaml",
    "pnpm-workspace.yaml",
    "yarn.lock",
];

const readManifest = (path: string): Manifest => JSON.parse(readFileSync(path, "utf8")) as Manifest;

const subexportNames = (packageDir: string): string[] =>
    Object.keys(readManifest(join(packageDir, "package.json")).exports ?? {})
        .filter((key) => key.startsWith("./") && key !== "./package.json")
        .map((key) => key.slice(2));

const loadPackage = (manifest: string, nodeModules: string): ResolvedPackage | null => {
    if (!existsSync(manifest)) {
        return null;
    }

    const real = realpathSync(manifest);

    return { dir: dirname(real), nodeModules, version: readManifest(real).version ?? "0.0.0" };
};

const isInstallRoot = (dir: string): boolean => {
    if (INSTALL_ROOT_MARKERS.some((marker) => existsSync(join(dir, marker)))) {
        return true;
    }

    const manifest = join(dir, "package.json");

    return existsSync(manifest) && readManifest(manifest).workspaces !== undefined;
};

const findInstallRoot = (projectRoot: string): string | null => {
    const { root } = parse(projectRoot);
    let current = projectRoot;

    while (current !== root) {
        if (isInstallRoot(current)) {
            return current;
        }

        current = dirname(current);
    }

    return isInstallRoot(root) ? root : null;
};

const nodeModulesChain = function* (projectRoot: string, installRoot: string | null): Generator<string> {
    const bound = installRoot ?? parse(projectRoot).root;
    let current = projectRoot;

    while (current !== bound && current !== dirname(current)) {
        yield join(current, "node_modules");
        current = dirname(current);
    }

    yield join(current, "node_modules");
};

const findPackage = (projectRoot: string, packageName: string, installRoot: string | null): ResolvedPackage | null => {
    for (const nodeModules of nodeModulesChain(projectRoot, installRoot)) {
        const found = loadPackage(join(nodeModules, packageName, "package.json"), nodeModules);

        if (found !== null) {
            return found;
        }
    }

    return null;
};

const resolvePackage = (
    projectRoot: string,
    packageName: string,
    installRoot: string | null,
): ResolvedPackage | null => {
    const found = findPackage(projectRoot, packageName, installRoot);

    if (found !== null) {
        return found;
    }

    const unscoped = packageName.replace(/^@[^/]+\//, "");

    return loadPackage(join(projectRoot, "packages", unscoped, "package.json"), join(projectRoot, "node_modules"));
};

const isWithin = (parent: string, child: string): boolean => {
    const path = relative(parent, child);

    return path === "" || !path.startsWith("..");
};

const isImportableFrom = (nodeModules: string, target: string): boolean =>
    isWithin(dirname(target), dirname(nodeModules));

const storeOptions = (nodeModules: string, name: string, version: string): StoreOptions => ({
    storeDir: join(nodeModules, STORE_DIR, name),
    linkDir: join(nodeModules, SCOPE, name),
    version,
});

const outsideInstallMessage = (projectRoot: string, installRoot: string, nodeModules: string): string =>
    `Cannot resolve @gtkx/runtime from ${projectRoot}: the nearest one is installed in ${nodeModules}, ` +
    `outside the install root ${installRoot}, and codegen never writes a store outside it. ` +
    `Install @gtkx/runtime under ${installRoot}, then run gtkx codegen again.`;

const missingRuntimeMessage = (projectRoot: string, installRoot: string | null): string => {
    const outside = installRoot === null ? null : findPackage(projectRoot, "@gtkx/runtime", null);

    if (outside === null || installRoot === null) {
        return `Cannot resolve @gtkx/runtime from ${projectRoot}; is it installed?`;
    }

    return outsideInstallMessage(projectRoot, installRoot, outside.nodeModules);
};

const splitInstallMessage = (nodeModules: string, runtime: ResolvedPackage): string =>
    `Cannot write the generated store to ${nodeModules}: @gtkx/react resolves from there, but @gtkx/runtime ` +
    `resolves from ${runtime.nodeModules}, which a store in ${nodeModules} cannot import. Install @gtkx/react ` +
    "and @gtkx/runtime in the same node_modules, then run gtkx codegen again.";

const resolveRuntime = (projectRoot: string, installRoot: string | null): ResolvedPackage => {
    const runtime = resolvePackage(projectRoot, "@gtkx/runtime", installRoot);

    if (runtime === null) {
        throw new Error(missingRuntimeMessage(projectRoot, installRoot));
    }

    return runtime;
};

const jsxOptions = (react: ResolvedPackage | null, nodeModules: string): StoreOptions | null =>
    react === null ? null : storeOptions(nodeModules, "jsx", react.version);

const getReactSubexports = (react: ResolvedPackage | null): string[] =>
    react === null ? [] : subexportNames(react.dir);

/**
 * Lists every path a generated store occupies in one `node_modules`: the `.gtkx` directories holding the
 * `gi` and `jsx` packages, and the `@gtkx` links pointing at them. Removing all four leaves that
 * `node_modules` with no generated bindings.
 *
 * @param nodeModules The `node_modules` directory to list paths in, whether or not a store was written there.
 * @returns The store and link directories, which need not exist.
 */
const getStorePaths = (nodeModules: string): string[] =>
    STORE_NAMES.flatMap((name) => [join(nodeModules, STORE_DIR, name), join(nodeModules, SCOPE, name)]);

/**
 * Resolves where a project's `@gtkx/gi` and `@gtkx/jsx` stores belong, from the project root alone. The
 * result supplies every `runCodegen` input except `libraries` and `girPath`, so a caller that has
 * already resolved those can spread it straight into the call.
 *
 * Both stores go in one `node_modules`: the one `@gtkx/react` resolves from, or `@gtkx/runtime`'s when no
 * React is installed. That is the project's own directory when it installs those packages itself, and the
 * workspace root when a package manager hoisted them there. Keeping the pair together is what lets the
 * jsx store import the gi store, and putting them beside `@gtkx/react` is what lets that package, the CLI,
 * and the project's sources all reach the bindings.
 *
 * The search stops at the project's install root, the nearest ancestor holding a lockfile, a
 * `pnpm-workspace.yaml`, or a `package.json` declaring workspaces, so a project that owns its install
 * never has a store written outside it. Projects below no install root at all keep walking to the
 * filesystem root, since the packages they will load at runtime are the ones that walk finds.
 *
 * Store versions come from the installed `@gtkx/runtime` and `@gtkx/react`, so a dependency upgrade
 * invalidates the stores. Pass explicit `gi` or `jsx` options to `runCodegen` to override any of it.
 *
 * @param projectRoot Directory holding the project's `package.json`, whose `node_modules` chain is walked.
 * @returns The store locations and the React subexports that shape the jsx store.
 * @throws If `@gtkx/runtime` cannot be resolved from the project, or resolves from a `node_modules` the
 * store would not be able to import it from.
 */
const resolveStore = (projectRoot: string): ResolvedStore => {
    const installRoot = findInstallRoot(projectRoot);
    const runtime = resolveRuntime(projectRoot, installRoot);
    const react = resolvePackage(projectRoot, "@gtkx/react", installRoot);
    const nodeModules = react?.nodeModules ?? runtime.nodeModules;

    if (!isImportableFrom(nodeModules, runtime.nodeModules)) {
        throw new Error(splitInstallMessage(nodeModules, runtime));
    }

    return {
        nodeModules,
        gi: storeOptions(nodeModules, "gi", runtime.version),
        jsx: jsxOptions(react, nodeModules),
        reactSubexports: getReactSubexports(react),
    };
};

export { getStorePaths, resolveStore, type ResolvedStore };

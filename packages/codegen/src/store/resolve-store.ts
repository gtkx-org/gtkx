import { existsSync, readFileSync, realpathSync } from "node:fs";
import { dirname, join, parse, relative, sep } from "node:path";
import type { StoreOptions } from "./store-fs.js";
import { sweepStagingDirs } from "../staging.js";

/**
 * Where a project's generated stores live, ready to spread into `runCodegen`. `jsx` is null when the
 * project has no `@gtkx/react` installed, in which case only the `@gtkx/gi` store can be generated.
 */
type ResolvedStore = {
    /** Where the `@gtkx/gi` store goes, versioned by the installed `@gtkx/runtime`. */
    gi: StoreOptions;
    /** Where the `@gtkx/jsx` store goes, versioned by the installed `@gtkx/react`; null when it is absent. */
    jsx: StoreOptions | null;
    /** Subexport names of the installed `@gtkx/react`, empty when it is absent. */
    reactSubexports: string[];
};

type ResolvedPackage = { dir: string; nodeModules: string; version: string };
type StoreConsumer = { name: string; nodeModules: string };

const STORE_DIR = ".gtkx";
const SCOPE = "@gtkx";
const STORE_NAMES: string[] = ["gi", "jsx"];

const STORE_CONSUMERS: string[] = [
    "@gtkx/animated",
    "@gtkx/cli",
    "@gtkx/components",
    "@gtkx/css",
    "@gtkx/forms",
    "@gtkx/i18n",
    "@gtkx/navigation",
    "@gtkx/react",
    "@gtkx/runtime",
    "@gtkx/testing",
];

const readManifest = (path: string): { version?: string; exports?: Record<string, unknown> } =>
    JSON.parse(readFileSync(path, "utf8")) as { version?: string; exports?: Record<string, unknown> };

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

const nodeModulesChain = function* (projectRoot: string): Generator<string> {
    const { root } = parse(projectRoot);
    let current = projectRoot;

    while (current !== root) {
        yield join(current, "node_modules");
        current = dirname(current);
    }

    yield join(root, "node_modules");
};

const resolvePackage = (projectRoot: string, packageName: string): ResolvedPackage | null => {
    for (const nodeModules of nodeModulesChain(projectRoot)) {
        const found = loadPackage(join(nodeModules, packageName, "package.json"), nodeModules);

        if (found !== null) {
            return found;
        }
    }

    const unscoped = packageName.replace(/^@[^/]+\//, "");

    return loadPackage(join(projectRoot, "packages", unscoped, "package.json"), join(projectRoot, "node_modules"));
};

const isWithin = (parent: string, child: string): boolean => {
    const path = relative(parent, child);

    return path === "" || (path !== ".." && !path.startsWith(`..${sep}`));
};

const canImport = (fromNodeModules: string, targetNodeModules: string): boolean =>
    isWithin(dirname(targetNodeModules), dirname(fromNodeModules));

const storeOptions = (nodeModules: string, name: string, version: string): StoreOptions => ({
    storeDir: join(nodeModules, STORE_DIR, name),
    linkDir: join(nodeModules, SCOPE, name),
    version,
});

const resolveRuntime = (projectRoot: string): ResolvedPackage => {
    const runtime = resolvePackage(projectRoot, "@gtkx/runtime");

    if (runtime === null) {
        throw new Error(`Cannot resolve @gtkx/runtime from ${projectRoot}; is it installed?`);
    }

    return runtime;
};

const storeNodeModules = (runtime: ResolvedPackage, react: ResolvedPackage | null): string => {
    if (react !== null && canImport(react.nodeModules, runtime.nodeModules)) {
        return react.nodeModules;
    }

    return runtime.nodeModules;
};

const findUnreachableConsumer = (projectRoot: string, nodeModules: string): StoreConsumer | null => {
    for (const name of STORE_CONSUMERS) {
        const consumer = resolvePackage(projectRoot, name);

        if (consumer !== null && !canImport(consumer.nodeModules, nodeModules)) {
            return { name, nodeModules: consumer.nodeModules };
        }
    }

    return null;
};

const unreachableConsumerMessage = (consumer: StoreConsumer, nodeModules: string): string =>
    `Cannot write the generated store to ${nodeModules}: ${consumer.name} is installed in ` +
    `${consumer.nodeModules}, above it, so that copy can never import the generated @gtkx/gi. Install every ` +
    "@gtkx package in one node_modules, then run gtkx codegen again.";

const checkConsumers = (projectRoot: string, nodeModules: string): void => {
    const consumer = findUnreachableConsumer(projectRoot, nodeModules);

    if (consumer !== null) {
        throw new Error(unreachableConsumerMessage(consumer, nodeModules));
    }
};

const jsxOptions = (react: ResolvedPackage | null, nodeModules: string): StoreOptions | null =>
    react === null ? null : storeOptions(nodeModules, "jsx", react.version);

const getReactSubexports = (react: ResolvedPackage | null): string[] =>
    react === null ? [] : subexportNames(react.dir);

const storePaths = (nodeModules: string): string[] =>
    STORE_NAMES.flatMap((name) => [join(nodeModules, STORE_DIR, name), join(nodeModules, SCOPE, name)]);

const findStoreNodeModules = (projectRoot: string): string | null => {
    const runtime = resolvePackage(projectRoot, "@gtkx/runtime");

    if (runtime === null) {
        return null;
    }

    return storeNodeModules(runtime, resolvePackage(projectRoot, "@gtkx/react"));
};

const getShadowingStorePaths = (projectRoot: string): string[] => {
    const nodeModules = join(projectRoot, "node_modules");
    const anchored = findStoreNodeModules(projectRoot);

    if (anchored === null || anchored === nodeModules) {
        return [];
    }

    return storePaths(nodeModules);
};

const stagingRoots = (projectRoot: string): string[] => {
    const nodeModules = join(projectRoot, "node_modules");
    const anchored = findStoreNodeModules(projectRoot);

    return anchored === null || anchored === nodeModules ? [nodeModules] : [nodeModules, anchored];
};

const sweepProjectStaging = (projectRoot: string): void => {
    for (const nodeModules of stagingRoots(projectRoot)) {
        for (const name of STORE_NAMES) {
            sweepStagingDirs(join(nodeModules, STORE_DIR, name));
        }
    }
};

/**
 * Resolves where a project's `@gtkx/gi` and `@gtkx/jsx` stores belong, from the project root alone. The
 * result supplies every `runCodegen` input except `libraries` and `girPath`, so a caller that has
 * already resolved those can spread it straight into the call.
 *
 * Both stores go in one `node_modules`, found by walking the project's `node_modules` chain upwards:
 * the one `@gtkx/react` resolves from, or `@gtkx/runtime`'s when no React is installed. That is the
 * project's own directory when it installs those packages itself, and the workspace root when npm or
 * yarn hoisted them there. Keeping the pair together is what lets the jsx store import the gi store, and
 * anchoring them where the `@gtkx` packages sit is what lets `@gtkx/react`, the CLI, and the project's
 * sources all reach the bindings. A package manager that hoists therefore gives every project sharing
 * that `node_modules` one shared store.
 *
 * Store versions come from the installed `@gtkx/runtime` and `@gtkx/react`, so a dependency upgrade
 * invalidates the stores. Pass explicit `gi` or `jsx` options to `runCodegen` to override any of it.
 *
 * @param projectRoot Directory holding the project's `package.json`, whose `node_modules` chain is walked.
 * @returns The store locations and the React subexports that shape the jsx store.
 * @throws If `@gtkx/runtime` cannot be resolved from the project, or a `@gtkx` package that imports the
 * bindings is installed above the `node_modules` the stores would go in, since it could not reach them.
 */
const resolveStore = (projectRoot: string): ResolvedStore => {
    const runtime = resolveRuntime(projectRoot);
    const react = resolvePackage(projectRoot, "@gtkx/react");
    const nodeModules = storeNodeModules(runtime, react);
    checkConsumers(projectRoot, nodeModules);

    return {
        gi: storeOptions(nodeModules, "gi", runtime.version),
        jsx: jsxOptions(react, nodeModules),
        reactSubexports: getReactSubexports(react),
    };
};

export { getShadowingStorePaths, nodeModulesChain, resolveStore, sweepProjectStaging, type ResolvedStore };

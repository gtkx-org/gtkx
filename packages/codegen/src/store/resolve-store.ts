import { isPathWithin } from "@gtkx/utils";
import { existsSync, readFileSync, realpathSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import type { StoreOptions } from "./store-fs.js";
import { EXTERNAL_NAMESPACES } from "../gir/external-namespaces.js";
import { sweepStagingDirs } from "../staging.js";
import { sharedProjectRoots } from "./shared-store.js";

/**
 * Locations for a project's generated stores. When `@gtkx/react` is absent, `jsx` is null; omit
 * it from `runCodegen` options to generate only GI.
 */
type ResolvedStore = {
    /** Where the `@gtkx/gi` store goes, versioned by the installed `@gtkx/runtime`. */
    gi: StoreOptions;
    /** Where the `@gtkx/jsx` store goes, versioned by the installed `@gtkx/react`; null when it is absent. */
    jsx: StoreOptions | null;
};

type ResolvedPackage = { nodeModules: string; directory: string; version: string };
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
    "@gtkx/storybook",
    "@gtkx/testing",
];

const GI_DEPENDENCIES: string[] = ["@gtkx/runtime", ...EXTERNAL_NAMESPACES.map(({ packageName }) => packageName)];
const JSX_DEPENDENCIES: string[] = ["@gtkx/react", "react", "@types/react"];

const readManifest = (path: string): { version?: string } =>
    JSON.parse(readFileSync(path, "utf8")) as { version?: string };

const nodeModulesChain = (projectRoot: string): string[] => {
    const chain: string[] = [];

    for (let current = resolve(projectRoot); ; current = dirname(current)) {
        chain.push(join(current, "node_modules"));

        if (dirname(current) === current) {
            return chain;
        }
    }
};

const installedNodeModules = (directory: string, chain: string[], linkedFrom: string): string =>
    chain.find((nodeModules) => isPathWithin(nodeModules, directory)) ?? linkedFrom;

const resolvePackage = (projectRoot: string, packageName: string): ResolvedPackage | null => {
    const chain = nodeModulesChain(projectRoot);

    for (const nodeModules of chain) {
        const manifest = join(nodeModules, packageName, "package.json");

        if (existsSync(manifest)) {
            const real = realpathSync(manifest);
            const directory = dirname(real);

            return {
                nodeModules: installedNodeModules(directory, chain, nodeModules),
                directory,
                version: readManifest(real).version ?? "0.0.0",
            };
        }
    }

    return null;
};

const resolveDependencies = (projectRoot: string, names: string[]): Record<string, string> =>
    Object.fromEntries(
        names.flatMap((name) => {
            const found = resolvePackage(projectRoot, name);

            return found === null ? [] : [[name, found.directory]];
        }),
    );

const canImport = (fromNodeModules: string, targetNodeModules: string): boolean =>
    isPathWithin(dirname(targetNodeModules), dirname(fromNodeModules));

const storeOptions = (
    nodeModules: string,
    name: string,
    version: string,
    owner: string,
    dependencies: Record<string, string>,
): StoreOptions => {
    return {
        storeDir: join(nodeModules, STORE_DIR, name),
        linkDir: join(nodeModules, SCOPE, name),
        version,
        owner,
        dependencies,
    };
};

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
    "@gtkx package locally in one node_modules, or move the project outside the ancestor dependency tree, " +
    "then run gtkx codegen again.";

const checkConsumers = (projectRoot: string, nodeModules: string): void => {
    const consumer = findUnreachableConsumer(projectRoot, nodeModules);

    if (consumer !== null) {
        throw new Error(unreachableConsumerMessage(consumer, nodeModules));
    }
};

const storePaths = (nodeModules: string): string[] =>
    STORE_NAMES.flatMap((name) => [join(nodeModules, STORE_DIR, name), join(nodeModules, SCOPE, name)]);

const findStoreNodeModules = (projectRoot: string): string | null => {
    const runtime = resolvePackage(projectRoot, "@gtkx/runtime");

    if (runtime === null) {
        return null;
    }

    return storeNodeModules(runtime, resolvePackage(projectRoot, "@gtkx/react"));
};

type SharedDependency = { name: string; ours: string; theirs: string };

const sharedDependencyMessage = (nodeModules: string, other: string, dependency: SharedDependency): string =>
    `Cannot share the generated store in ${nodeModules} with ${other}: this project resolves ${dependency.name} ` +
    `to ${dependency.ours}, but ${other} resolves it to ${dependency.theirs}. Projects that resolve the same store, ` +
    "such as the apps of a pnpm workspace, have to install the same versions of the @gtkx packages, react and " +
    "@types/react; align them, then run gtkx codegen again.";

const checkSharedDependencies = (owner: string, nodeModules: string, dependencies: Record<string, string>): void => {
    const anchor = realpathSync(nodeModules);

    for (const other of sharedProjectRoots(join(nodeModules, STORE_DIR, "gi"), owner)) {
        const otherNodeModules = findStoreNodeModules(other);

        if (otherNodeModules === null || realpathSync(otherNodeModules) !== anchor) {
            continue;
        }

        const required = resolveDependencies(other, [...GI_DEPENDENCIES, ...JSX_DEPENDENCIES]);

        for (const [name, directory] of Object.entries(dependencies)) {
            const theirs = required[name];

            if (theirs !== undefined && theirs !== directory) {
                throw new Error(sharedDependencyMessage(nodeModules, other, { name, ours: directory, theirs }));
            }
        }
    }
};

const getShadowingStorePaths = (projectRoot: string): string[] => {
    const root = resolve(projectRoot);
    const nodeModules = join(root, "node_modules");
    const anchored = findStoreNodeModules(root);

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
    const root = resolve(projectRoot);

    for (const nodeModules of stagingRoots(root)) {
        for (const name of STORE_NAMES) {
            sweepStagingDirs(join(nodeModules, STORE_DIR, name));
        }
    }
};

/**
 * Resolves generated GI and JSX store options from a project's installed dependencies.
 * Pass the result to `runCodegen` alongside `libraries` and `girPath`, omitting `jsx` when null.
 *
 * @remarks
 * Both stores share one `node_modules` directory selected from the project's ancestor chain:
 * the one the installed renderer and runtime are installed in, which for pnpm's isolated layout
 * is the workspace root holding `.pnpm`, not the directory their links sit in. Hoisted or
 * workspace installs can therefore give several projects one shared store, generated with the
 * union of their libraries. The store links the packages its bindings import to the copies
 * the project resolves. Store versions follow `@gtkx/runtime` and `@gtkx/react`, so upgrades
 * invalidate generated output. Explicit `gi` or `jsx` options override this selection.
 *
 * @param projectRoot Directory containing the project's `package.json`.
 * @returns Store locations and versions, with `jsx` set to null when React is absent.
 * @throws If runtime cannot be resolved, a binding consumer is installed above the selected
 * store and cannot import it, or another project sharing the store resolves a different copy
 * of a package the bindings import.
 */
const resolveStore = (projectRoot: string): ResolvedStore => {
    const root = resolve(projectRoot);
    const owner = realpathSync(root);
    const runtime = resolveRuntime(root);
    const react = resolvePackage(root, "@gtkx/react");
    const nodeModules = storeNodeModules(runtime, react);
    checkConsumers(root, nodeModules);
    const giDependencies = resolveDependencies(root, GI_DEPENDENCIES);
    const jsxDependencies = resolveDependencies(root, JSX_DEPENDENCIES);
    checkSharedDependencies(owner, nodeModules, { ...giDependencies, ...jsxDependencies });

    return {
        gi: storeOptions(nodeModules, "gi", runtime.version, owner, giDependencies),
        jsx: react === null ? null : storeOptions(nodeModules, "jsx", react.version, owner, jsxDependencies),
    };
};

export { getShadowingStorePaths, resolveStore, sweepProjectStaging, type ResolvedStore };

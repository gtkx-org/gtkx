import { isPathWithin } from "@gtkx/utils";
import { existsSync, readFileSync, realpathSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import type { StoreOptions } from "./store-fs.js";
import { sweepStagingDirs } from "../staging.js";

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

type ResolvedPackage = { nodeModules: string; version: string };
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
    "@gtkx/storybook",
    "@gtkx/testing",
];

const readManifest = (path: string): { version?: string } =>
    JSON.parse(readFileSync(path, "utf8")) as { version?: string };

const loadPackage = (manifest: string, nodeModules: string): ResolvedPackage | null => {
    if (!existsSync(manifest)) {
        return null;
    }

    const real = realpathSync(manifest);

    return { nodeModules, version: readManifest(real).version ?? "0.0.0" };
};

const nodeModulesChain = function* (projectRoot: string): Generator<string> {
    let current = resolve(projectRoot);

    for (;;) {
        yield join(current, "node_modules");
        const parent = dirname(current);

        if (parent === current) {
            return;
        }

        current = parent;
    }
};

const resolvePackage = (projectRoot: string, packageName: string): ResolvedPackage | null => {
    for (const nodeModules of nodeModulesChain(projectRoot)) {
        const found = loadPackage(join(nodeModules, packageName, "package.json"), nodeModules);

        if (found !== null) {
            return found;
        }
    }

    return null;
};

const canImport = (fromNodeModules: string, targetNodeModules: string): boolean =>
    isPathWithin(dirname(targetNodeModules), dirname(fromNodeModules));

const storeOptions = (nodeModules: string, name: string, version: string, owner: string): StoreOptions => {
    return {
        storeDir: join(nodeModules, STORE_DIR, name),
        linkDir: join(nodeModules, SCOPE, name),
        version,
        owner,
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
 * Both stores share one `node_modules` directory selected from the project's ancestor chain,
 * using the installed renderer and runtime. Hoisted packages can therefore give several
 * projects one shared store. Store versions follow `@gtkx/runtime` and `@gtkx/react`, so
 * upgrades invalidate generated output. Explicit `gi` or `jsx` options override this selection.
 *
 * @param projectRoot Directory containing the project's `package.json`.
 * @returns Store locations and versions, with `jsx` set to null when React is absent.
 * @throws If runtime cannot be resolved, or a binding consumer is installed above the selected
 * store and cannot import it.
 */
const resolveStore = (projectRoot: string): ResolvedStore => {
    const root = resolve(projectRoot);
    const owner = realpathSync(root);
    const runtime = resolveRuntime(root);
    const react = resolvePackage(root, "@gtkx/react");
    const nodeModules = storeNodeModules(runtime, react);
    checkConsumers(root, nodeModules);

    return {
        gi: storeOptions(nodeModules, "gi", runtime.version, owner),
        jsx: react === null ? null : storeOptions(nodeModules, "jsx", react.version, owner),
    };
};

export { getShadowingStorePaths, resolveStore, sweepProjectStaging, type ResolvedStore };

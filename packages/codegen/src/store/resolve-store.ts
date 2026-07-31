import { existsSync, readFileSync, realpathSync } from "node:fs";
import { dirname, join, parse } from "node:path";
import type { StoreOptions } from "./store-fs.js";

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

type ResolvedPackage = { dir: string; version: string };

const STORE_DIR = ".gtkx";
const SCOPE = "@gtkx";

const readManifest = (path: string): { version?: string; exports?: Record<string, unknown> } =>
    JSON.parse(readFileSync(path, "utf8")) as { version?: string; exports?: Record<string, unknown> };

const subexportNames = (packageDir: string): string[] =>
    Object.keys(readManifest(join(packageDir, "package.json")).exports ?? {})
        .filter((key) => key.startsWith("./") && key !== "./package.json")
        .map((key) => key.slice(2));

const loadPackage = (manifest: string): ResolvedPackage | null => {
    if (!existsSync(manifest)) {
        return null;
    }

    const real = realpathSync(manifest);

    return { dir: dirname(real), version: readManifest(real).version ?? "0.0.0" };
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
        const found = loadPackage(join(nodeModules, packageName, "package.json"));

        if (found !== null) {
            return found;
        }
    }

    return loadPackage(join(projectRoot, "packages", packageName.replace(/^@[^/]+\//, ""), "package.json"));
};

const storeOptions = (nodeModules: string, name: string, version: string): StoreOptions => ({
    storeDir: join(nodeModules, STORE_DIR, name),
    linkDir: join(nodeModules, SCOPE, name),
    version,
});

/**
 * Resolves where a project's `@gtkx/gi` and `@gtkx/jsx` stores belong, from the project root alone. The
 * result supplies every `runCodegen` input except `libraries` and `girPath`, so a caller that has
 * already resolved those can spread it straight into the call.
 *
 * Store versions come from the installed `@gtkx/runtime` and `@gtkx/react`, so a dependency upgrade
 * invalidates the stores. Pass explicit `gi` or `jsx` options to `runCodegen` to override any of it.
 *
 * @param projectRoot Directory holding the project's `package.json` and `node_modules`.
 * @returns The store locations and the React subexports that shape the jsx store.
 * @throws If `@gtkx/runtime` cannot be resolved from the project.
 */
const resolveStore = (projectRoot: string): ResolvedStore => {
    const runtime = resolvePackage(projectRoot, "@gtkx/runtime");

    if (runtime === null) {
        throw new Error(`Cannot resolve @gtkx/runtime from ${projectRoot}; is it installed?`);
    }

    const react = resolvePackage(projectRoot, "@gtkx/react");
    const nodeModules = join(projectRoot, "node_modules");

    return {
        gi: storeOptions(nodeModules, "gi", runtime.version),
        jsx: react === null ? null : storeOptions(nodeModules, "jsx", react.version),
        reactSubexports: react === null ? [] : subexportNames(react.dir),
    };
};

export { resolveStore, type ResolvedStore };

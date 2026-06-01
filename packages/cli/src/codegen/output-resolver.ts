import { existsSync, readFileSync, realpathSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { pathToFileURL } from "node:url";

/**
 * Resolved locations for the codegen-owned injected packages.
 *
 * Codegen materializes `@gtkx/gi` (and, when React is present,
 * `@gtkx/react-jsx`) into a hidden `node_modules/.gtkx` store and exposes each
 * through a visible `node_modules/@gtkx/<name>` symlink. The injected packages
 * resolve `@gtkx/ffi`/`react` through their own bundled symlinks, so the real
 * directories of those runtime dependencies are resolved here too.
 */
export type CodegenStore = {
    /** Hidden store for the `@gtkx/gi` bindings package. */
    readonly giStoreDir: string;
    /** Visible `@gtkx/gi` alias symlink. */
    readonly giLinkDir: string;
    /** Hidden store for the `@gtkx/react-jsx` unit. */
    readonly jsxStoreDir: string;
    /** Visible `@gtkx/react-jsx` alias symlink. */
    readonly jsxLinkDir: string;
    /** Real directory of the installed `@gtkx/ffi`. */
    readonly realFfiDir: string;
    /** `@gtkx/ffi`'s version, copied onto the emitted `@gtkx/gi`. */
    readonly ffiVersion: string;
    /** Real directory of the installed `@gtkx/react`, or `null` when absent. */
    readonly realReactDir: string | null;
    /** Real directory of the installed `react` runtime, or `null` when absent. */
    readonly realReactRuntimeDir: string | null;
    /** `@gtkx/react`'s version, or `null` when absent. */
    readonly reactVersion: string | null;
};

type ResolvedPackage = { readonly dir: string; readonly version: string };

const readVersion = (packageJsonPath: string): string => {
    const parsed = JSON.parse(readFileSync(packageJsonPath, "utf8")) as { version?: string };
    return parsed.version ?? "0.0.0";
};

/**
 * Resolves a package's real directory and version, falling back to the gtkx
 * monorepo workspace layout (`<projectRoot>/packages/<name>`) when the package
 * is not resolvable as an installed dependency.
 */
const resolvePackage = (require: NodeJS.Require, projectRoot: string, packageName: string): ResolvedPackage | null => {
    try {
        const real = realpathSync(require.resolve(`${packageName}/package.json`));
        return { dir: dirname(real), version: readVersion(real) };
    } catch {
        const unscoped = packageName.replace(/^@[^/]+\//, "");
        const workspacePkg = join(projectRoot, "packages", unscoped, "package.json");
        if (!existsSync(workspacePkg)) return null;
        const real = realpathSync(workspacePkg);
        return { dir: dirname(real), version: readVersion(real) };
    }
};

/**
 * Resolves the store layout codegen writes into for `projectRoot`.
 *
 * @param projectRoot - Absolute path to the project root
 * @returns The resolved {@link CodegenStore}
 * @throws If `@gtkx/ffi` cannot be located from the project
 */
export const resolveCodegenStore = (projectRoot: string): CodegenStore => {
    const require = createRequire(pathToFileURL(join(projectRoot, "__gtkx_resolver__.js")).href);

    const ffi = resolvePackage(require, projectRoot, "@gtkx/ffi");
    if (ffi === null) {
        throw new Error("Cannot resolve @gtkx/ffi from the project; is it installed?");
    }
    const react = resolvePackage(require, projectRoot, "@gtkx/react");
    const reactRuntime = resolvePackage(require, projectRoot, "react");

    const nodeModules = join(projectRoot, "node_modules");
    return {
        giStoreDir: join(nodeModules, ".gtkx", "gi"),
        giLinkDir: join(nodeModules, "@gtkx", "gi"),
        jsxStoreDir: join(nodeModules, ".gtkx", "jsx"),
        jsxLinkDir: join(nodeModules, "@gtkx", "react-jsx"),
        realFfiDir: ffi.dir,
        ffiVersion: ffi.version,
        realReactDir: react?.dir ?? null,
        realReactRuntimeDir: reactRuntime?.dir ?? null,
        reactVersion: react?.version ?? null,
    };
};

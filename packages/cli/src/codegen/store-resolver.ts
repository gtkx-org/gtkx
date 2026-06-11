import { existsSync, readFileSync, realpathSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join, parse } from "node:path";
import { pathToFileURL } from "node:url";

const CONFIG_FILENAMES: readonly string[] = ["gtkx.config.ts", "gtkx.config.js", "gtkx.config.mjs"];

const hasGtkxConfig = (dir: string): boolean => CONFIG_FILENAMES.some((name) => existsSync(join(dir, name)));

/**
 * Whether `dir` is the root of a JavaScript monorepo, across package managers:
 * a `pnpm-workspace.yaml` (pnpm) or a `workspaces` field in `package.json`
 * (npm, Yarn, Bun).
 */
const isWorkspaceRoot = (dir: string): boolean => {
    if (existsSync(join(dir, "pnpm-workspace.yaml"))) return true;
    const packageJson = join(dir, "package.json");
    if (!existsSync(packageJson)) return false;
    try {
        return (JSON.parse(readFileSync(packageJson, "utf8")) as { workspaces?: unknown }).workspaces !== undefined;
    } catch {
        return false;
    }
};

/**
 * Resolves the directory whose generated store and config drive codegen for
 * `projectRoot`.
 *
 * In a workspace whose root declares its own `gtkx.config.ts`, every member
 * shares that single root store — the root config is authored as the union of
 * all members' libraries — so a member never materializes a second, shadowing
 * copy that would split wrapper-class identity. A standalone project, or a
 * workspace root without a config, resolves to `projectRoot` unchanged.
 *
 * @param projectRoot - Absolute path to the project being generated for
 * @returns The workspace root that owns the shared store, or `projectRoot`
 */
export const findCodegenRoot = (projectRoot: string): string => {
    const { root } = parse(projectRoot);
    let dir = projectRoot;
    while (true) {
        if (isWorkspaceRoot(dir) && hasGtkxConfig(dir)) return dir;
        if (dir === root) return projectRoot;
        dir = dirname(dir);
    }
};

/**
 * Resolved locations for the codegen-owned injected packages.
 *
 * Codegen materializes `@gtkx/gi` (and, when React is present,
 * `@gtkx/jsx`) into a hidden `node_modules/.gtkx` store and exposes each
 * through a visible `node_modules/@gtkx/<name>` symlink. The injected packages
 * resolve `@gtkx/ffi`/`react` through their own bundled symlinks, so the real
 * directories of those runtime dependencies are resolved here too.
 */
export type CodegenStore = {
    /** Hidden store for the `@gtkx/gi` bindings package. */
    readonly giStoreDir: string;
    /** Visible `@gtkx/gi` alias symlink. */
    readonly giLinkDir: string;
    /** Hidden store for the `@gtkx/jsx` package. */
    readonly jsxStoreDir: string;
    /** Visible `@gtkx/jsx` alias symlink. */
    readonly jsxLinkDir: string;
    /** Real directory of the installed `@gtkx/ffi`. */
    readonly realFfiDir: string;
    /** Real directory of the installed `@gtkx/native`. */
    readonly realNativeDir: string;
    /** `@gtkx/ffi`'s version, copied onto the emitted `@gtkx/gi`. */
    readonly ffiVersion: string;
    /** Installed `@gtkx/react` package, or `null` when absent. */
    readonly react: CodegenReactPackage | null;
    /** Real directory of the installed `react` runtime, or `null` when absent. */
    readonly realReactRuntimeDir: string | null;
};

/**
 * The installed `@gtkx/react` package, whose real directory and version are
 * always resolved together: the version is copied onto the emitted
 * `@gtkx/jsx` package.
 */
export type CodegenReactPackage = {
    /** Real directory of the installed `@gtkx/react`. */
    readonly realDir: string;
    /** `@gtkx/react`'s version. */
    readonly version: string;
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
    const root = findCodegenRoot(projectRoot);
    const require = createRequire(pathToFileURL(join(root, "__gtkx_resolver__.js")).href);

    const ffi = resolvePackage(require, root, "@gtkx/ffi");
    if (ffi === null) {
        throw new Error("Cannot resolve @gtkx/ffi from the project; is it installed?");
    }
    const native = resolvePackage(require, root, "@gtkx/native");
    if (native === null) {
        throw new Error("Cannot resolve @gtkx/native from the project; is it installed?");
    }
    const react = resolvePackage(require, root, "@gtkx/react");
    const reactRuntime = resolvePackage(require, root, "react");

    const nodeModules = join(root, "node_modules");
    return {
        giStoreDir: join(nodeModules, ".gtkx", "gi"),
        giLinkDir: join(nodeModules, "@gtkx", "gi"),
        jsxStoreDir: join(nodeModules, ".gtkx", "jsx"),
        jsxLinkDir: join(nodeModules, "@gtkx", "jsx"),
        realFfiDir: ffi.dir,
        realNativeDir: native.dir,
        ffiVersion: ffi.version,
        react: react === null ? null : { realDir: react.dir, version: react.version },
        realReactRuntimeDir: reactRuntime?.dir ?? null,
    };
};

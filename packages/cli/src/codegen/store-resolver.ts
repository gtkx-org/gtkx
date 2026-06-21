import { existsSync, readFileSync, realpathSync, rmSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join, parse } from "node:path";
import { pathToFileURL } from "node:url";
import { type GtkxConfig, GtkxConfigNotFoundError, loadGtkxConfig } from "@gtkx/config";
import { GtkxError } from "../internal/errors.js";

const CONFIG_FILENAMES: string[] = ["gtkx.config.ts", "gtkx.config.js", "gtkx.config.mjs"];

const hasGtkxConfig = (dir: string): boolean => CONFIG_FILENAMES.some((name) => existsSync(join(dir, name)));

export const isWorkspaceRoot = (dir: string): boolean => {
    if (existsSync(join(dir, "pnpm-workspace.yaml"))) return true;
    const packageJson = join(dir, "package.json");
    if (!existsSync(packageJson)) return false;
    try {
        return (JSON.parse(readFileSync(packageJson, "utf8")) as { workspaces?: unknown }).workspaces !== undefined;
    } catch {
        return false;
    }
};

export const findCodegenRoot = (projectRoot: string): string => {
    const { root } = parse(projectRoot);
    let dir = projectRoot;
    while (true) {
        if (isWorkspaceRoot(dir) && hasGtkxConfig(dir)) return dir;
        if (dir === root) return projectRoot;
        dir = dirname(dir);
    }
};

export type CodegenStore = {
    giStoreDir: string;
    giLinkDir: string;
    jsxStoreDir: string;
    jsxLinkDir: string;
    realFfiDir: string;
    realNativeDir: string;
    ffiVersion: string;
    react: CodegenReactPackage | null;
    realReactRuntimeDir: string | null;
};

export type CodegenReactPackage = {
    realDir: string;
    version: string;
};

type ResolvedPackage = { dir: string; version: string };

const readVersion = (packageJsonPath: string): string => {
    const parsed = JSON.parse(readFileSync(packageJsonPath, "utf8")) as { version?: string };
    return parsed.version ?? "0.0.0";
};

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

export const resolveCodegenStore = (projectRoot: string): CodegenStore => {
    const root = findCodegenRoot(projectRoot);
    const require = createRequire(pathToFileURL(join(root, "__gtkx_resolver__.js")).href);

    const ffi = resolvePackage(require, root, "@gtkx/ffi");
    if (ffi === null) {
        throw new GtkxError("Cannot resolve @gtkx/ffi from the project; is it installed?");
    }
    const native = resolvePackage(require, root, "@gtkx/native");
    if (native === null) {
        throw new GtkxError("Cannot resolve @gtkx/native from the project; is it installed?");
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

const pruneShadowingStore = (memberDir: string): void => {
    const nodeModules = join(memberDir, "node_modules");
    for (const path of [
        join(nodeModules, ".gtkx", "gi"),
        join(nodeModules, ".gtkx", "jsx"),
        join(nodeModules, "@gtkx", "gi"),
        join(nodeModules, "@gtkx", "jsx"),
    ]) {
        rmSync(path, { recursive: true, force: true });
    }
};

export const resolveCodegenContext = async (cwd: string): Promise<{ root: string; config: GtkxConfig } | null> => {
    const root = findCodegenRoot(cwd);
    if (root !== cwd) pruneShadowingStore(cwd);
    try {
        const { config } = await loadGtkxConfig(root);
        return { root, config };
    } catch (error) {
        if (error instanceof GtkxConfigNotFoundError) return null;
        throw error;
    }
};

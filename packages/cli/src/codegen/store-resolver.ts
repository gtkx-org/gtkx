import { existsSync, readFileSync, realpathSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { pathToFileURL } from "node:url";
import { type GtkxConfig, loadGtkxConfig } from "@gtkx/config";
import { GtkxError } from "../internal/errors.js";

export type CodegenStore = {
    giStoreDir: string;
    giLinkDir: string;
    jsxStoreDir: string;
    jsxLinkDir: string;
    ffiVersion: string;
    react: CodegenReactPackage | null;
};

type CodegenReactPackage = {
    version: string;
};

type ResolvedPackage = { dir: string; version: string };

const readVersion = (packageJsonPath: string): string => {
    const parsed = JSON.parse(readFileSync(packageJsonPath, "utf8")) as { version?: string };
    return parsed.version ?? "0.0.0";
};

const resolvePackage = (require: NodeJS.Require, dir: string, packageName: string): ResolvedPackage | null => {
    try {
        const real = realpathSync(require.resolve(`${packageName}/package.json`));
        return { dir: dirname(real), version: readVersion(real) };
    } catch {
        const unscoped = packageName.replace(/^@[^/]+\//, "");
        const workspacePkg = join(dir, "packages", unscoped, "package.json");
        if (!existsSync(workspacePkg)) return null;
        const real = realpathSync(workspacePkg);
        return { dir: dirname(real), version: readVersion(real) };
    }
};

export const resolveCodegenStore = (dir: string): CodegenStore => {
    const require = createRequire(pathToFileURL(join(dir, "__gtkx_resolver__.js")).href);

    const ffi = resolvePackage(require, dir, "@gtkx/ffi");
    if (ffi === null) {
        throw new GtkxError("Cannot resolve @gtkx/ffi from the project; is it installed?");
    }
    const native = resolvePackage(require, dir, "@gtkx/native");
    if (native === null) {
        throw new GtkxError("Cannot resolve @gtkx/native from the project; is it installed?");
    }
    const react = resolvePackage(require, dir, "@gtkx/react");
    const reactRuntime = resolvePackage(require, dir, "react");

    const nodeModules = join(dir, "node_modules");
    return {
        giStoreDir: join(nodeModules, ".gtkx", "gi"),
        giLinkDir: join(nodeModules, "@gtkx", "gi"),
        jsxStoreDir: join(nodeModules, ".gtkx", "jsx"),
        jsxLinkDir: join(nodeModules, "@gtkx", "jsx"),
        ffiVersion: ffi.version,
        react: react !== null && reactRuntime !== null ? { version: react.version } : null,
    };
};

export type CodegenContext = {
    root: string;
    config: GtkxConfig;
    configFile: string | undefined;
};

export const resolveCodegenContext = async (cwd: string, mode?: string): Promise<CodegenContext | null> => {
    const { config, configFile } = await loadGtkxConfig(cwd, { mode });
    if (configFile === undefined) return null;
    return { root: cwd, config, configFile };
};

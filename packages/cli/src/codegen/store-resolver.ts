import { type Config, loadConfig } from "@gtkx/config";
import { existsSync, readFileSync, realpathSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { pathToFileURL } from "node:url";

type CodegenStore = {
    giStoreDir: string;
    giLinkDir: string;
    jsxStoreDir: string;
    jsxLinkDir: string;
    runtimeVersion: string;
    react: CodegenReactPackage | null;
};

type CodegenReactPackage = {
    version: string;
    subexports: string[];
};

type ResolvedPackage = { dir: string; version: string };

type CodegenContext = {
    root: string;
    config: Config;
    configFile: string | undefined;
};

const readVersion = (packageJsonPath: string): string => {
    const parsed = JSON.parse(readFileSync(packageJsonPath, "utf8")) as { version?: string };

    return parsed.version ?? "0.0.0";
};

const readSubexports = (packageDir: string): string[] => {
    const parsed = JSON.parse(readFileSync(join(packageDir, "package.json"), "utf8")) as {
        exports?: Record<string, unknown>;
    };

    return Object.keys(parsed.exports ?? {})
        .filter((key) => key.startsWith("./") && key !== "./package.json")
        .map((key) => key.slice(2));
};

/** Resolves the `@gtkx/react` subexport names for a project without requiring runtime/native to be installed. */
const resolveReactSubexports = (dir: string): string[] => {
    const require = createRequire(pathToFileURL(join(dir, "__gtkx_resolver__.js")).href);
    const react = resolvePackage(require, dir, "@gtkx/react");

    return react === null ? [] : readSubexports(react.dir);
};

const resolvePackage = (require: NodeJS.Require, dir: string, packageName: string): ResolvedPackage | null => {
    try {
        const real = realpathSync(require.resolve(`${packageName}/package.json`));

        return { dir: dirname(real), version: readVersion(real) };
    } catch {
        const unscoped = packageName.replace(/^@[^/]+\//, "");
        const workspacePkg = join(dir, "packages", unscoped, "package.json");

        if (!existsSync(workspacePkg)) {
            return null;
        }

        const real = realpathSync(workspacePkg);

        return { dir: dirname(real), version: readVersion(real) };
    }
};

const resolveCodegenStore = (dir: string): CodegenStore => {
    const require = createRequire(pathToFileURL(join(dir, "__gtkx_resolver__.js")).href);
    const runtime = resolvePackage(require, dir, "@gtkx/runtime");

    if (runtime === null) {
        throw new Error("Cannot resolve @gtkx/runtime from the project; is it installed?");
    }

    const native = resolvePackage(require, dir, "@gtkx/native");

    if (native === null) {
        throw new Error("Cannot resolve @gtkx/native from the project; is it installed?");
    }

    const react = resolvePackage(require, dir, "@gtkx/react");
    const reactRuntime = resolvePackage(require, dir, "react");
    const nodeModules = join(dir, "node_modules");

    return {
        giStoreDir: join(nodeModules, ".gtkx", "gi"),
        giLinkDir: join(nodeModules, "@gtkx", "gi"),
        jsxStoreDir: join(nodeModules, ".gtkx", "jsx"),
        jsxLinkDir: join(nodeModules, "@gtkx", "jsx"),
        runtimeVersion: runtime.version,
        react:
            react !== null && reactRuntime !== null
                ? {
                        version: react.version,
                        subexports: readSubexports(react.dir),
                    }
                : null,
    };
};

const resolveCodegenContext = async (cwd: string, mode?: string): Promise<CodegenContext | null> => {
    const { config, configFile } = await loadConfig(cwd, { mode });

    if (configFile === undefined) {
        return null;
    }

    return { root: cwd, config, configFile };
};

export { resolveReactSubexports, resolveCodegenStore, resolveCodegenContext, type CodegenStore, type CodegenContext };

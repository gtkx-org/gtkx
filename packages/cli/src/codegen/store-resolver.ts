import { resolveStore } from "@gtkx/codegen";
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
    configFile: string;
};

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

        if (!existsSync(workspacePkg)) {
            return null;
        }

        const real = realpathSync(workspacePkg);

        return { dir: dirname(real), version: readVersion(real) };
    }
};

// Where the jsx store would live when @gtkx/react is absent, so a stale one can still be cleared.
const siblingStore = (giDir: string): string => join(dirname(giDir), "jsx");

const resolveCodegenStore = (dir: string): CodegenStore => {
    const require = createRequire(pathToFileURL(join(dir, "__gtkx_resolver__.js")).href);

    if (resolvePackage(require, dir, "@gtkx/native") === null) {
        throw new Error("Cannot resolve @gtkx/native from the project; is it installed?");
    }

    const store = resolveStore(dir);
    const hasReactRuntime = resolvePackage(require, dir, "react") !== null;

    return {
        giStoreDir: store.gi.storeDir,
        giLinkDir: store.gi.linkDir,
        jsxStoreDir: store.jsx?.storeDir ?? siblingStore(store.gi.storeDir),
        jsxLinkDir: store.jsx?.linkDir ?? siblingStore(store.gi.linkDir),
        runtimeVersion: store.gi.version,
        react:
            hasReactRuntime && store.jsx !== null
                ? { version: store.jsx.version, subexports: store.reactSubexports }
                : null,
    };
};

const resolveCodegenContext = async (cwd: string, mode?: string): Promise<CodegenContext> => {
    const { config, configFile } = await loadConfig(cwd, { mode });

    return { root: cwd, config, configFile };
};

export { resolveCodegenStore, resolveCodegenContext, type CodegenStore, type CodegenContext };

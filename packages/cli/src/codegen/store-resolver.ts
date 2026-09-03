import { resolveStore } from "@gtkx/codegen";
import { type Config, loadConfig } from "@gtkx/config";
import { existsSync, realpathSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { pathToFileURL } from "node:url";

type CodegenStore = {
    giStoreDir: string;
    giLinkDir: string;
    jsxStoreDir: string;
    jsxLinkDir: string;
    runtimeVersion: string;
    owner: string;
    react: CodegenReactPackage | null;
};

type CodegenReactPackage = {
    version: string;
};

type CodegenContext = {
    root: string;
    config: Config;
    configFile: string;
};

const hasPackage = (require: NodeJS.Require, dir: string, packageName: string): boolean => {
    try {
        require.resolve(`${packageName}/package.json`);

        return true;
    } catch {
        const unscoped = packageName.replace(/^@[^/]+\//, "");

        return existsSync(join(dir, "packages", unscoped, "package.json"));
    }
};

const siblingStore = (giDir: string): string => join(dirname(giDir), "jsx");

const resolveCodegenStore = (dir: string): CodegenStore => {
    const require = createRequire(pathToFileURL(join(dir, "__gtkx_resolver__.js")).href);

    if (!hasPackage(require, dir, "@gtkx/native")) {
        throw new Error("Cannot resolve @gtkx/native from the project; is it installed?");
    }

    const store = resolveStore(dir);
    const hasReactRuntime = hasPackage(require, dir, "react");

    return {
        giStoreDir: store.gi.storeDir,
        giLinkDir: store.gi.linkDir,
        jsxStoreDir: store.jsx?.storeDir ?? siblingStore(store.gi.storeDir),
        jsxLinkDir: store.jsx?.linkDir ?? siblingStore(store.gi.linkDir),
        runtimeVersion: store.gi.version,
        owner: store.gi.owner ?? realpathSync(dir),
        react:
            hasReactRuntime && store.jsx !== null
                ? { version: store.jsx.version }
                : null,
    };
};

const resolveCodegenContext = async (cwd: string, mode?: string, selectedConfig?: string): Promise<CodegenContext> => {
    const { config, configFile } = await loadConfig(cwd, { mode, configFile: selectedConfig });

    return { root: cwd, config, configFile };
};

export { resolveCodegenStore, resolveCodegenContext, type CodegenContext, type CodegenStore };

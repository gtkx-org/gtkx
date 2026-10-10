import { realpathSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { pathToFileURL } from "node:url";
import { resolveStore } from "../store/resolve-store.js";

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

const hasPackage = (require: NodeJS.Require, packageName: string): boolean => {
    try {
        require.resolve(`${packageName}/package.json`);

        return true;
    } catch {
        return false;
    }
};

const siblingStore = (giDir: string): string => join(dirname(giDir), "jsx");

const resolveCodegenStore = (dir: string): CodegenStore => {
    const require = createRequire(pathToFileURL(join(dir, "__gtkx_resolver__.js")).href);

    if (!hasPackage(require, "@gtkx/native")) {
        throw new Error("Cannot resolve @gtkx/native from the project; is it installed?");
    }

    const store = resolveStore(dir);
    const hasReactRuntime = hasPackage(require, "react");

    return {
        giStoreDir: store.gi.storeDir,
        giLinkDir: store.gi.linkDir,
        jsxStoreDir: store.jsx?.storeDir ?? siblingStore(store.gi.storeDir),
        jsxLinkDir: store.jsx?.linkDir ?? siblingStore(store.gi.linkDir),
        runtimeVersion: store.gi.version,
        owner: store.gi.owner ?? realpathSync(dir),
        react: hasReactRuntime && store.jsx !== null ? { version: store.jsx.version } : null,
    };
};

export { resolveCodegenStore, type CodegenStore };

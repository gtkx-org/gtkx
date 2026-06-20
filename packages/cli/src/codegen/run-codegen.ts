import { rmSync } from "node:fs";
import { resolve } from "node:path";
import { CodegenRunner } from "@gtkx/codegen";
import {
    type GtkxConfig,
    GtkxConfigNotFoundError,
    loadGtkxConfig,
    resolveDataDir,
    type UserTableRows,
} from "@gtkx/config";
import { emitSchemaEnv } from "../gsettings/env.js";
import { info } from "../internal/log.js";
import { isCodegenNeeded } from "./freshness.js";
import { resolveGirPath } from "./gir-resolver.js";
import { resolveLibraries } from "./library-resolver.js";
import {
    type CodegenStore,
    findCodegenRoot,
    isWorkspaceRoot,
    resolveCodegenContext,
    resolveCodegenStore,
} from "./store-resolver.js";

export type RunCodegenOptions = {
    cwd?: string;
    force?: boolean;
};

export type RunCodegenResult = {
    namespaces: number;
    widgets: number;
    duration: number;
    girPath?: string[] | undefined;
    configFile?: string | undefined;
    libraries?: string[] | undefined;
};

const tableRows = (config: GtkxConfig): UserTableRows => {
    const { containerProps, arrayProps, objectProps, virtualProps, elementMap } = config;
    return { containerProps, arrayProps, objectProps, virtualProps, elementMap };
};

const buildRunner = (store: CodegenStore, libraries: string[], girPath: string[], config: GtkxConfig): CodegenRunner =>
    new CodegenRunner({
        libraries,
        girPath,
        ...tableRows(config),
        gi: {
            storeDir: store.giStoreDir,
            linkDir: store.giLinkDir,
            realFfiDir: store.realFfiDir,
            realNativeDir: store.realNativeDir,
            version: store.ffiVersion,
        },
        jsx:
            store.react !== null && store.realReactRuntimeDir !== null
                ? {
                      storeDir: store.jsxStoreDir,
                      linkDir: store.jsxLinkDir,
                      giStoreDir: store.giStoreDir,
                      realReactRuntimeDir: store.realReactRuntimeDir,
                      realReactPackageDir: store.react.realDir,
                      version: store.react.version,
                  }
                : undefined,
    });

export const runCodegen = async (options: RunCodegenOptions = {}): Promise<RunCodegenResult> => {
    const cwd = findCodegenRoot(options.cwd ?? process.cwd());

    const { config, configFile } = await loadGtkxConfig(cwd);

    const girPath = resolveGirPath(config.girPath);
    const libraries = resolveLibraries(config.libraries, girPath);

    const store = resolveCodegenStore(cwd);

    if (girPath.length === 0) {
        throw new Error(
            "No GIR search paths available. Install gobject-introspection (Linux: `sudo dnf install gobject-introspection-devel` or `sudo apt install libgirepository1.0-dev`), or set `girPath` in gtkx.config.ts.",
        );
    }

    if (options.force) {
        for (const path of [store.giStoreDir, store.giLinkDir, store.jsxStoreDir, store.jsxLinkDir]) {
            rmSync(path, { recursive: true, force: true });
        }
    }

    const result = await buildRunner(store, libraries, girPath, config).run();

    return {
        namespaces: result.namespaces,
        widgets: result.widgets,
        duration: result.duration,
        girPath,
        configFile,
        libraries,
    };
};

export const syncSchemaEnv = (cwd: string): void => {
    if (isWorkspaceRoot(cwd)) return;
    emitSchemaEnv(cwd, resolveDataDir(cwd));
};

export const ensureGenerated = async (cwd: string): Promise<boolean> => {
    const context = await resolveCodegenContext(cwd);
    if (!context) {
        return false;
    }
    syncSchemaEnv(cwd);
    if (!isCodegenNeeded(context.root, context.config)) {
        return false;
    }
    await runCodegen({ cwd: context.root });
    return true;
};

export const preflightCodegen = async (cwd: string): Promise<void> => {
    if (process.env["GTKX_DISABLE_PREFLIGHT"] === "1") {
        return;
    }

    const context = await resolveCodegenContext(cwd);
    if (!context) {
        return;
    }
    syncSchemaEnv(cwd);
    if (isCodegenNeeded(context.root, context.config)) {
        info("generated bindings missing; running codegen...");
        await runCodegen({ cwd: context.root });
    }
};

export const resolveConfigWatch = async (
    cwd: string,
): Promise<{ paths: string[]; regenerate: () => Promise<void> } | undefined> => {
    const root = findCodegenRoot(cwd);
    try {
        const { configFile, rootDir } = await loadGtkxConfig(root);
        if (configFile === undefined) return undefined;
        return {
            paths: [resolve(rootDir, configFile)],
            regenerate: async () => {
                await runCodegen({ cwd: root });
            },
        };
    } catch (error) {
        if (error instanceof GtkxConfigNotFoundError) return undefined;
        throw error;
    }
};

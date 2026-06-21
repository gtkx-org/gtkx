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
import { GtkxError } from "../internal/errors.js";
import { info } from "../internal/log.js";
import { type CodegenInputs, isCodegenNeeded, resolveCodegenInputs } from "./freshness.js";
import { type CodegenStore, findCodegenRoot, isWorkspaceRoot, resolveCodegenContext } from "./store-resolver.js";

export type RunCodegenOptions = {
    cwd?: string;
    force?: boolean;
    inputs?: CodegenInputs;
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
        tables: tableRows(config),
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

    const { girPath, libraries, store } = options.inputs ?? resolveCodegenInputs(cwd, config);

    if (girPath.length === 0) {
        throw new GtkxError(
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

const resolveInputsOrNull = (cwd: string, config: GtkxConfig): CodegenInputs | null => {
    try {
        return resolveCodegenInputs(cwd, config);
    } catch {
        return null;
    }
};

export const ensureGenerated = async (cwd: string): Promise<boolean> => {
    const context = await resolveCodegenContext(cwd);
    if (!context) {
        return false;
    }
    syncSchemaEnv(cwd);
    const inputs = resolveInputsOrNull(context.root, context.config);
    if (inputs !== null && !isCodegenNeeded(context.config, inputs)) {
        return false;
    }
    await runCodegen(inputs === null ? { cwd: context.root } : { cwd: context.root, inputs });
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
    const inputs = resolveInputsOrNull(context.root, context.config);
    if (inputs === null || isCodegenNeeded(context.config, inputs)) {
        info("generated bindings missing; running codegen...");
        await runCodegen(inputs === null ? { cwd: context.root } : { cwd: context.root, inputs });
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

import { rmSync } from "node:fs";
import { resolve } from "node:path";
import { runCodegen as runCodegenCore } from "@gtkx/codegen";
import { type ElementProp, type GtkxConfig, loadGtkxConfig } from "@gtkx/config";
import { info } from "@gtkx/utils";
import { emitSchemaEnv } from "../gsettings/env.js";
import { resolveDataDir } from "../internal/data-dir.js";
import { GtkxError } from "../internal/errors.js";
import { type CodegenInputs, isCodegenStale, resolveCodegenInputs } from "./freshness.js";
import { type CodegenStore, resolveCodegenContext } from "./store-resolver.js";

export type RunCodegenOptions = {
    cwd?: string;
    mode?: string | undefined;
    force?: boolean;
    inputs?: CodegenInputs;
    resolved?: LoadedConfig;
};

type LoadedConfig = {
    config: GtkxConfig;
    configFile: string | undefined;
};

export type RunCodegenResult = {
    namespaces: number;
    intrinsicElements: number;
    duration: number;
    girPath?: string[] | undefined;
    configFile?: string | undefined;
    libraries?: string[] | undefined;
};

const removeSharedStoreShadow = (cwd: string): void => {
    for (const path of [
        resolve(cwd, "node_modules/.gtkx/gi"),
        resolve(cwd, "node_modules/.gtkx/jsx"),
        resolve(cwd, "node_modules/@gtkx/gi"),
        resolve(cwd, "node_modules/@gtkx/jsx"),
    ]) {
        rmSync(path, { recursive: true, force: true });
    }
};

const codegenOptions = (
    store: CodegenStore,
    libraries: string[],
    girPath: string[],
    elementProps: Record<string, ElementProp[]>,
) => ({
    libraries,
    girPath,
    elementProps,
    gi: {
        storeDir: store.giStoreDir,
        linkDir: store.giLinkDir,
        version: store.ffiVersion,
    },
    jsx:
        store.react !== null
            ? {
                  storeDir: store.jsxStoreDir,
                  linkDir: store.jsxLinkDir,
                  version: store.react.version,
              }
            : undefined,
});

export const runCodegen = async (options: RunCodegenOptions = {}): Promise<RunCodegenResult> => {
    const cwd = options.cwd ?? process.cwd();

    const { config, configFile } = options.resolved ?? (await loadGtkxConfig(cwd, { mode: options.mode }));

    if (config.codegen === false) {
        removeSharedStoreShadow(cwd);
        return { namespaces: 0, intrinsicElements: 0, duration: 0, girPath: [], configFile, libraries: [] };
    }

    const { girPath, libraries, elementProps, store } = options.inputs ?? resolveCodegenInputs(cwd, config);

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

    const result = await runCodegenCore(codegenOptions(store, libraries, girPath, elementProps));

    return {
        namespaces: result.namespaces,
        intrinsicElements: result.intrinsicElements,
        duration: result.duration,
        girPath,
        configFile,
        libraries,
    };
};

export const isCodegenDisabled = async (cwd: string, mode?: string): Promise<boolean> => {
    try {
        const { config } = await loadGtkxConfig(cwd, { mode });
        return config.codegen === false;
    } catch {
        return false;
    }
};

export const syncSchemaEnv = (cwd: string): void => {
    const dataDir = resolveDataDir(cwd);
    if (dataDir === null) return;
    emitSchemaEnv(cwd, dataDir);
};

const resolveInputsOrNull = (cwd: string, config: GtkxConfig): CodegenInputs | null => {
    try {
        return resolveCodegenInputs(cwd, config);
    } catch {
        return null;
    }
};

export const ensureGenerated = async (
    cwd: string,
    options: { announce?: boolean; mode?: string } = {},
): Promise<boolean> => {
    if (options.announce && process.env.GTKX_DISABLE_PREFLIGHT === "1") {
        return false;
    }

    const context = await resolveCodegenContext(cwd, options.mode);
    if (!context) {
        return false;
    }
    syncSchemaEnv(cwd);
    if (context.config.codegen === false) {
        removeSharedStoreShadow(context.root);
        return false;
    }
    const inputs = resolveInputsOrNull(context.root, context.config);
    if (inputs !== null && !isCodegenStale(inputs)) {
        return false;
    }
    if (options.announce) {
        info("generated bindings missing; running codegen...");
    }
    const resolved = { config: context.config, configFile: context.configFile };
    await runCodegen(
        inputs === null
            ? { cwd: context.root, mode: options.mode, resolved }
            : { cwd: context.root, mode: options.mode, inputs, resolved },
    );
    return true;
};

export const resolveConfigWatch = async (
    cwd: string,
    mode?: string,
): Promise<{ paths: string[]; regenerate: () => Promise<void> } | undefined> => {
    const { configFile, root } = await loadGtkxConfig(cwd, { mode });
    if (configFile === undefined) return undefined;
    return {
        paths: [resolve(root, configFile)],
        regenerate: async () => {
            await runCodegen({ cwd: root, mode });
        },
    };
};

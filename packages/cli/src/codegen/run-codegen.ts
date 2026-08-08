import { runCodegen as runCodegenCore } from "@gtkx/codegen";
import { type Config, loadConfig } from "@gtkx/config";
import {
    resolveElementComponents,
    resolveElementProps,
    resolveLazyElements,
    resolveOmittedProps,
} from "@gtkx/config/internal";
import { info } from "@gtkx/utils";
import { rmSync } from "node:fs";
import { resolve } from "node:path";
import { resolveDataDir } from "../internal/data-dir.js";
import { emitSchemaEnv } from "../settings/schema.js";
import { type CodegenInputs, isCodegenStale, resolveCodegenInputs } from "./freshness.js";
import { type CodegenStore, resolveCodegenContext } from "./store-resolver.js";

type RunCodegenOptions = {
    cwd?: string;
    mode?: string | undefined;
    isForced?: boolean;
    inputs?: CodegenInputs;
    resolved?: LoadedConfig;
};

type LoadedConfig = {
    config: Config;
    configFile: string;
};

type RunCodegenResult = {
    isRegenerated: boolean;
    namespaces: number;
    intrinsicElements: number;
    duration: number;
    girPath?: string[] | undefined;
    configFile?: string | undefined;
    libraries?: string[] | undefined;
};

type CodegenOptionsInput = {
    store: CodegenStore;
    libraries: string[];
    girPath: string[];
    elements: Config["elements"];
};

type PreparedCodegen = CodegenInputs & { isForced: boolean };

type RunOptionsInput = {
    root: string;
    mode: string | undefined;
    inputs: CodegenInputs | null;
    resolved: LoadedConfig;
};

const GIR_PATH_MISSING_MESSAGE =
    "No GIR search paths available. Install gobject-introspection " +
    "(Linux: `sudo dnf install gobject-introspection-devel` or `sudo apt install libgirepository1.0-dev`), " +
    "or set `girPath` in gtkx.config.ts.";

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

const codegenOptions = ({ store, libraries, girPath, elements }: CodegenOptionsInput) => ({
    libraries,
    girPath,
    gi: {
        storeDir: store.giStoreDir,
        linkDir: store.giLinkDir,
        version: store.runtimeVersion,
    },
    jsx:
        store.react === null
            ? undefined
            : {
                    storeDir: store.jsxStoreDir,
                    linkDir: store.jsxLinkDir,
                    version: store.react.version,
                },
    reactSubexports: store.react?.subexports ?? [],
    userComponents: resolveElementComponents(elements),
    userProps: resolveElementProps(elements),
    userLazyElements: resolveLazyElements(elements),
    userOmittedProps: resolveOmittedProps(elements),
});

const disabledCodegenResult = (configFile: string): RunCodegenResult => ({
    isRegenerated: false,
    namespaces: 0,
    intrinsicElements: 0,
    duration: 0,
    girPath: [],
    configFile,
    libraries: [],
});

const clearGeneratedStores = (store: CodegenStore): void => {
    for (const path of [store.giStoreDir, store.giLinkDir, store.jsxStoreDir, store.jsxLinkDir]) {
        rmSync(path, { recursive: true, force: true });
    }
};

const resolveLoadedConfig = async (options: RunCodegenOptions, cwd: string): Promise<LoadedConfig> =>
    options.resolved ?? (await loadConfig(cwd, { mode: options.mode }));

const prepareCodegen = (options: RunCodegenOptions, cwd: string, config: Config): PreparedCodegen => {
    const { girPath, libraries, store } = options.inputs ?? resolveCodegenInputs(cwd, config);

    if (girPath.length === 0) {
        throw new Error(GIR_PATH_MISSING_MESSAGE);
    }

    const isForced = options.isForced === true || isCodegenStale({ girPath, libraries, store });

    return { girPath, libraries, store, isForced };
};

const runCodegen = async (options: RunCodegenOptions = {}): Promise<RunCodegenResult> => {
    const cwd = options.cwd ?? process.cwd();
    const { config, configFile } = await resolveLoadedConfig(options, cwd);

    if (config.codegen === false) {
        removeSharedStoreShadow(cwd);

        return disabledCodegenResult(configFile);
    }

    const { girPath, libraries, store, isForced } = prepareCodegen(options, cwd, config);

    if (options.isForced) {
        clearGeneratedStores(store);
    }

    const result = await runCodegenCore({
        ...codegenOptions({
            store,
            libraries,
            girPath,
            elements: config.elements,
        }),
        isForced,
    });

    return {
        isRegenerated: result.isRegenerated,
        namespaces: result.namespaces,
        intrinsicElements: result.intrinsicElements,
        duration: result.duration,
        girPath,
        configFile,
        libraries,
    };
};

const isCodegenDisabled = async (cwd: string, mode?: string): Promise<boolean> => {
    try {
        const { config } = await loadConfig(cwd, { mode });

        return config.codegen === false;
    } catch {
        return false;
    }
};

const syncSchemaEnv = (cwd: string): void => {
    emitSchemaEnv(cwd, resolveDataDir(cwd));
};

const resolveInputsOrNull = (cwd: string, config: Config): CodegenInputs | null => {
    try {
        return resolveCodegenInputs(cwd, config);
    } catch {
        return null;
    }
};

const maybeAnnounceStale = (shouldAnnounce: boolean | undefined, inputs: CodegenInputs | null): void => {
    if (!shouldAnnounce) {
        return;
    }

    if (inputs === null || isCodegenStale(inputs)) {
        info("generated bindings missing; running codegen...");
    }
};

const getRunOptions = ({ root, mode, inputs, resolved }: RunOptionsInput): RunCodegenOptions => {
    if (inputs === null) {
        return { cwd: root, mode, resolved };
    }

    return { cwd: root, mode, inputs, resolved };
};

/* eslint-disable-next-line unicorn/consistent-boolean-name -- the boolean reports whether codegen ran */
const ensureGenerated = async (
    cwd: string,
    options: { shouldAnnounce?: boolean; mode?: string } = {},
): Promise<boolean> => {
    if (options.shouldAnnounce && process.env.GTKX_DISABLE_PREFLIGHT === "1") {
        return false;
    }

    const context = await resolveCodegenContext(cwd, options.mode);
    syncSchemaEnv(cwd);

    if (context.config.codegen === false) {
        removeSharedStoreShadow(context.root);

        return false;
    }

    const inputs = resolveInputsOrNull(context.root, context.config);
    maybeAnnounceStale(options.shouldAnnounce, inputs);
    const resolved = { config: context.config, configFile: context.configFile };
    const result = await runCodegen(getRunOptions({ root: context.root, mode: options.mode, inputs, resolved }));

    return result.isRegenerated;
};

const resolveConfigWatch = async (
    cwd: string,
    mode?: string,
): Promise<{ paths: string[]; regenerate: () => Promise<void> }> => {
    const { configFile, root } = await loadConfig(cwd, { mode });

    return {
        paths: [resolve(root, configFile)],
        regenerate: async () => {
            await runCodegen({ cwd: root, mode });
        },
    };
};

export {
    runCodegen,
    isCodegenDisabled,
    syncSchemaEnv,
    ensureGenerated,
    resolveConfigWatch,
    type RunCodegenResult,
};

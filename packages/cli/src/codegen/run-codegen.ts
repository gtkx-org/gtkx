import { runCodegen as runCodegenCore } from "@gtkx/codegen";
import { getShadowingStorePaths, sweepProjectStaging } from "@gtkx/codegen/internal";
import { type Config, loadConfig } from "@gtkx/config";
import {
    resolveElementComponents,
    resolveElementProps,
    resolveLazyElements,
    resolveOmittedProps,
} from "@gtkx/config/internal";
import { info, warn } from "@gtkx/utils";
import { rmSync } from "node:fs";
import { resolve } from "node:path";
import { resolveDataDir } from "../internal/data-dir.js";
import { emitSchemaEnv } from "../settings/schema.js";
import { type CodegenInputs, isCodegenStale, resolveCodegenInputs } from "./freshness.js";
import { type CodegenContext, type CodegenStore, resolveCodegenContext } from "./store-resolver.js";

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
    notices: string[];
    duration: number;
    girPath?: string[] | undefined;
    configFile?: string | undefined;
    libraries?: string[] | undefined;
    future?: string[] | undefined;
};

type CodegenOptionsInput = {
    store: CodegenStore;
    libraries: string[];
    girPath: string[];
    elements: Config["elements"];
    isByteArrayTyped: boolean;
    isValueUnwrapped: boolean;
};

type PreparedCodegen = CodegenInputs & { isForced: boolean };
type EnsureGeneratedOptions = { shouldAnnounce?: boolean; mode?: string };

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

const removeStores = (paths: string[]): void => {
    for (const path of paths) {
        rmSync(path, { recursive: true, force: true });
    }
};

const removeShadowingStores = (cwd: string): void => {
    sweepProjectStaging(cwd);
    removeStores(getShadowingStorePaths(cwd));
};

const codegenOptions = ({ store, libraries, girPath, elements, ...future }: CodegenOptionsInput) => ({
    libraries,
    girPath,
    isByteArrayTyped: future.isByteArrayTyped,
    isValueUnwrapped: future.isValueUnwrapped,
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

const enabledFutureFlags = (config: Config): string[] =>
    Object.entries(config.future ?? {})
        .filter(([, value]) => value === true)
        .map(([name]) => name);

const disabledCodegenResult = (configFile: string): RunCodegenResult => ({
    isRegenerated: false,
    namespaces: 0,
    intrinsicElements: 0,
    notices: [],
    duration: 0,
    girPath: [],
    configFile,
    libraries: [],
});

const warnNotices = (notices: string[]): void => {
    for (const notice of notices) {
        warn(notice);
    }
};

const regeneratedStorePaths = (store: CodegenStore): string[] => {
    if (store.react === null) {
        return [store.giStoreDir, store.giLinkDir];
    }

    return [store.giStoreDir, store.giLinkDir, store.jsxStoreDir, store.jsxLinkDir];
};

const clearGeneratedStores = (store: CodegenStore): void => {
    removeStores(regeneratedStorePaths(store));
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
        removeShadowingStores(cwd);

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
            isByteArrayTyped: config.future?.v2ByteArrays === true,
            isValueUnwrapped: config.future?.v2ValueReturns === true,
        }),
        isForced,
    });

    warnNotices(result.notices);

    return {
        isRegenerated: result.isRegenerated,
        namespaces: result.namespaces,
        intrinsicElements: result.intrinsicElements,
        notices: result.notices,
        duration: result.duration,
        girPath,
        configFile,
        libraries,
        future: enabledFutureFlags(config),
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

const isPreflightSkipped = (options: EnsureGeneratedOptions): boolean =>
    options.shouldAnnounce === true && process.env.GTKX_DISABLE_PREFLIGHT === "1";

/* eslint-disable-next-line unicorn/consistent-boolean-name -- the boolean reports whether codegen ran */
const generate = async (context: CodegenContext, options: EnsureGeneratedOptions): Promise<boolean> => {
    syncSchemaEnv(context.root);

    if (context.config.codegen === false) {
        removeShadowingStores(context.root);

        return false;
    }

    const inputs = resolveInputsOrNull(context.root, context.config);
    maybeAnnounceStale(options.shouldAnnounce, inputs);
    const resolved = { config: context.config, configFile: context.configFile };
    const result = await runCodegen(getRunOptions({ root: context.root, mode: options.mode, inputs, resolved }));

    return result.isRegenerated;
};

/* eslint-disable-next-line unicorn/consistent-boolean-name -- the boolean reports whether codegen ran */
const ensureGeneratedIn = async (
    context: CodegenContext,
    options: EnsureGeneratedOptions = {},
): Promise<boolean> => (isPreflightSkipped(options) ? false : generate(context, options));

/* eslint-disable-next-line unicorn/consistent-boolean-name -- the boolean reports whether codegen ran */
const ensureGenerated = async (cwd: string, options: EnsureGeneratedOptions = {}): Promise<boolean> =>
    isPreflightSkipped(options) ? false : generate(await resolveCodegenContext(cwd, options.mode), options);

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
    ensureGeneratedIn,
    resolveConfigWatch,
    type RunCodegenResult,
};

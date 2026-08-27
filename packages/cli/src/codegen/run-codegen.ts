import { runCodegen as runCodegenCore } from "@gtkx/codegen";
import { getShadowingStorePaths, sweepProjectStaging } from "@gtkx/codegen/internal";
import { type Config, loadConfig } from "@gtkx/config";
import {
    isAgentRulesEnabled,
    resolveElementComponents,
    resolveElementProps,
    resolveLazyElements,
    resolveOmittedProps,
} from "@gtkx/config/internal";
import { info, warn } from "@gtkx/utils";
import { existsSync, rmSync } from "node:fs";
import { join, resolve } from "node:path";
import { resolveCatalogProject, synchronizeCatalogs } from "../i18n/catalogs.js";
import { extractSourceCatalog } from "../i18n/source-messages.js";
import { emitI18nTypes } from "../i18n/types.js";
import { upsertAgentRules } from "../internal/agent-rules.js";
import { resolveDataDir } from "../internal/data-dir.js";
import { discoverSourceFiles } from "../internal/source-imports.js";
import { emitSchemaEnv } from "../settings/schema.js";
import { type CodegenInputs, isCodegenStale, resolveCodegenInputs } from "./freshness.js";
import { type ReferenceResult, writeReference } from "./reference.js";
import { type CodegenContext, type CodegenStore, resolveCodegenContext } from "./store-resolver.js";

type RunCodegenOptions = {
    cwd?: string;
    mode?: string | undefined;
    isForced?: boolean;
    inputs?: CodegenInputs;
    resolved?: LoadedConfig;
    shouldPreserveI18nMetadata?: boolean | undefined;
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
    reference?: ReferenceResult | undefined;
};

type CodegenOptionsInput = {
    store: CodegenStore;
    libraries: string[];
    girPath: string[];
    elements: Config["elements"];
    isByteArrayTyped: boolean;
    isValueUnwrapped: boolean;
    isFinishTrimmed: boolean;
    isInoutInPlace: boolean;
};

type PreparedCodegen = CodegenInputs & { isForced: boolean };

type EnsureGeneratedOptions = {
    shouldAnnounce?: boolean;
    mode?: string;
    shouldPreserveI18nMetadata?: boolean | undefined;
};

type RunOptionsInput = {
    root: string;
    mode: string | undefined;
    inputs: CodegenInputs | null;
    resolved: LoadedConfig;
    shouldPreserveI18nMetadata: boolean | undefined;
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
    isFinishTrimmed: future.isFinishTrimmed,
    isInoutInPlace: future.isInoutInPlace,
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
    await syncI18n(cwd, config.applicationId, options.shouldPreserveI18nMetadata);
    syncSchemaEnv(cwd, config.future?.v2ResourceImports === true);

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
            isFinishTrimmed: config.future?.v2FinishResults === true,
            isInoutInPlace: config.future?.v2InoutReturns === true,
        }),
        isForced,
    });

    warnNotices(result.notices);
    const reference = await writeReference({ root: cwd, config, girPath, libraries, isForced });
    syncAgentRules(cwd, config);

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
        reference,
    };
};

const syncAgentRules = (root: string, config: Config): void => {
    if (isAgentRulesEnabled(config)) {
        upsertAgentRules(root);
    }
};

const syncI18n = async (
    root: string,
    applicationId: string,
    shouldPreserveMetadataMessages = true,
): Promise<void> => {
    const project = resolveCatalogProject(root, applicationId);

    if (project === null) {
        emitI18nTypes(root, [], false);

        return;
    }

    const srcDir = join(root, "src");
    const sourceFiles = discoverSourceFiles(existsSync(srcDir) ? srcDir : root);
    const catalog = await extractSourceCatalog(project, sourceFiles, shouldPreserveMetadataMessages);
    synchronizeCatalogs(project);
    emitI18nTypes(root, catalog.messages);
};

const isCodegenDisabled = async (cwd: string, mode?: string): Promise<boolean> => {
    try {
        const { config } = await loadConfig(cwd, { mode });

        return config.codegen === false;
    } catch {
        return false;
    }
};

const syncSchemaEnv = (cwd: string, isV2ResourceImports = false): void => {
    const dataDir = isV2ResourceImports ? null : resolveDataDir(cwd);
    emitSchemaEnv(cwd, dataDir, isV2ResourceImports);
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

const getRunOptions = ({
    root,
    mode,
    inputs,
    resolved,
    shouldPreserveI18nMetadata,
}: RunOptionsInput): RunCodegenOptions => {
    if (inputs === null) {
        return { cwd: root, mode, resolved, shouldPreserveI18nMetadata };
    }

    return { cwd: root, mode, inputs, resolved, shouldPreserveI18nMetadata };
};

const isPreflightSkipped = (options: EnsureGeneratedOptions): boolean =>
    options.shouldAnnounce === true && process.env.GTKX_DISABLE_PREFLIGHT === "1";

/* eslint-disable-next-line unicorn/consistent-boolean-name -- the boolean reports whether codegen ran */
const generate = async (context: CodegenContext, options: EnsureGeneratedOptions): Promise<boolean> => {
    if (context.config.codegen === false) {
        const result = await runCodegen({
            cwd: context.root,
            mode: options.mode,
            resolved: { config: context.config, configFile: context.configFile },
            shouldPreserveI18nMetadata: options.shouldPreserveI18nMetadata,
        });

        return result.isRegenerated;
    }

    const inputs = resolveInputsOrNull(context.root, context.config);
    maybeAnnounceStale(options.shouldAnnounce, inputs);
    const resolved = { config: context.config, configFile: context.configFile };

    const result = await runCodegen(getRunOptions({
        root: context.root,
        mode: options.mode,
        inputs,
        resolved,
        shouldPreserveI18nMetadata: options.shouldPreserveI18nMetadata,
    }));

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
    ensureGenerated,
    ensureGeneratedIn,
    resolveConfigWatch,
    type RunCodegenResult,
};

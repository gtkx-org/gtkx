import {
    type CodegenInputs,
    generateBindings,
    getShadowingStorePaths,
    isCodegenStale,
    resolveCodegenInputs,
    sweepProjectStaging,
} from "@gtkx/codegen/internal";
import { type Config, loadConfig } from "@gtkx/config";
import { createConfigReloader, isAgentRulesEnabled } from "@gtkx/config/internal";
import { info } from "@gtkx/utils";
import { existsSync, rmSync } from "node:fs";
import { join } from "node:path";
import { resolveCatalogProject, synchronizeCatalogs } from "../i18n/catalogs.js";
import { extractSourceCatalog } from "../i18n/source-messages.js";
import { clearI18nTypes, emitI18nTypes } from "../i18n/types.js";
import { upsertAgentRules } from "../internal/agent-rules.js";
import { discoverSourceFiles } from "../internal/source-imports.js";
import { emitSchemaEnv } from "../settings/schema.js";
import { type ReferenceResult, writeReference } from "./reference.js";
import { type CodegenContext, resolveCodegenContext } from "./store-resolver.js";

type RunCodegenOptions = {
    cwd?: string;
    mode?: string | undefined;
    configFile?: string | undefined;
    isForced?: boolean;
    lockTimeoutMs?: number | undefined;
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
    duration: number;
    girPath: string[];
    configFile: string;
    libraries: string[];
    reference?: ReferenceResult | undefined;
};

type EnsureGeneratedOptions = {
    shouldAnnounce?: boolean;
    lockTimeoutMs?: number | undefined;
    mode?: string;
    configFile?: string | undefined;
    shouldPreserveI18nMetadata?: boolean | undefined;
};

const removeStores = (paths: string[]): void => {
    for (const path of paths) {
        rmSync(path, { recursive: true, force: true });
    }
};

const removeShadowingStores = (cwd: string): void => {
    sweepProjectStaging(cwd);
    removeStores(getShadowingStorePaths(cwd));
};

const disabledCodegenResult = (configFile: string): RunCodegenResult => ({
    isRegenerated: false,
    namespaces: 0,
    intrinsicElements: 0,
    duration: 0,
    girPath: [],
    configFile,
    libraries: [],
});

const runCodegen = async (options: RunCodegenOptions = {}): Promise<RunCodegenResult> => {
    const cwd = options.cwd ?? process.cwd();
    const { config, configFile } =
        options.resolved ??
        (await loadConfig(cwd, {
            mode: options.mode,
            configFile: options.configFile,
        }));
    await syncI18n(cwd, config.applicationId, options.shouldPreserveI18nMetadata);
    emitSchemaEnv(cwd);

    if (config.codegen === false) {
        removeShadowingStores(cwd);

        return disabledCodegenResult(configFile);
    }

    const result = await generateBindings({
        cwd,
        config,
        ...(options.inputs !== undefined && { inputs: options.inputs }),
        isForced: options.isForced === true,
        lockTimeoutMs: options.lockTimeoutMs,
    });
    const { girPath, libraries, store, isForced } = result;

    const reference = await writeReference({
        root: cwd,
        config,
        girPath,
        libraries,
        isForced,
        declarationDir: store.giStoreDir,
    });

    if (isAgentRulesEnabled(config)) {
        upsertAgentRules(cwd);
    }

    return {
        isRegenerated: result.isRegenerated,
        namespaces: result.namespaces,
        intrinsicElements: result.intrinsicElements,
        duration: result.duration,
        girPath,
        configFile,
        libraries,
        reference,
    };
};

const syncI18n = async (root: string, applicationId: string, shouldPreserveMetadataMessages = true): Promise<void> => {
    const project = resolveCatalogProject(root, applicationId);

    if (project === null) {
        clearI18nTypes(root);

        return;
    }

    const srcDir = join(root, "src");
    const sourceFiles = discoverSourceFiles(existsSync(srcDir) ? srcDir : root);
    await extractSourceCatalog(project, sourceFiles, shouldPreserveMetadataMessages);
    synchronizeCatalogs(project);
    await emitI18nTypes(root);
};

const isCodegenDisabled = async (cwd: string, mode?: string, configFile?: string): Promise<boolean> => {
    try {
        const { config } = await loadConfig(cwd, { mode, configFile });

        return config.codegen === false;
    } catch {
        return false;
    }
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

const generate = async (context: CodegenContext, options: EnsureGeneratedOptions): Promise<boolean> => {
    if (context.config.codegen === false) {
        const result = await runCodegen({
            cwd: context.root,
            mode: options.mode,
            lockTimeoutMs: options.lockTimeoutMs,
            resolved: { config: context.config, configFile: context.configFile },
            shouldPreserveI18nMetadata: options.shouldPreserveI18nMetadata,
        });

        return result.isRegenerated;
    }

    const inputs = resolveInputsOrNull(context.root, context.config);
    maybeAnnounceStale(options.shouldAnnounce, inputs);
    const resolved = { config: context.config, configFile: context.configFile };

    const result = await runCodegen({
        cwd: context.root,
        mode: options.mode,
        lockTimeoutMs: options.lockTimeoutMs,
        resolved,
        shouldPreserveI18nMetadata: options.shouldPreserveI18nMetadata,
        ...(inputs !== null && { inputs }),
    });

    return result.isRegenerated;
};

const ensureGeneratedIn = async (context: CodegenContext, options: EnsureGeneratedOptions = {}): Promise<boolean> =>
    generate(context, options);

const ensureGenerated = async (cwd: string, options: EnsureGeneratedOptions = {}): Promise<boolean> =>
    generate(await resolveCodegenContext(cwd, options.mode, options.configFile), options);

const resolveConfigWatch = async (
    cwd: string,
    mode?: string,
    configFile?: string,
    initialDependencies: string[] = [],
): Promise<{ paths: string[]; resolvePaths: () => string[]; regenerate: () => Promise<string[]> }> => {
    const { reload, resolvePaths } = await createConfigReloader(cwd, { mode, configFile }, initialDependencies);

    return {
        paths: resolvePaths(),
        resolvePaths,
        regenerate: async () => {
            const loaded = await reload();
            await runCodegen({ cwd, mode, resolved: loaded });

            return resolvePaths();
        },
    };
};

export { runCodegen, isCodegenDisabled, ensureGenerated, ensureGeneratedIn, resolveConfigWatch, type RunCodegenResult };
